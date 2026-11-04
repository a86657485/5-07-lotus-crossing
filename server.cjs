'use strict';
/**
 * 五年级第7课《重复操作用循环》·莲花山智慧路口课堂服务
 * 默认 PORT=8797；DATA_DIR 可指到 .data-test/ 等临时目录。勿占用 8766。
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { isIP } = require('node:net');
const { DatabaseSync } = require('node:sqlite');
const { evaluateAnswers, QUIZ_VERSION } = require('./quiz.cjs');

const BASE = __dirname;
const CLASSES = ['501', '502', '503', '504'];
const APP_ID = 'lotus-crossing-5-07';
const RELIC_QUOTA = 3;
const DEFAULT_PORT = 8797;

function fail(status, message, code) {
  throw Object.assign(new Error(message), { status, code });
}

function isPrivateAddress(address) {
  if (!address) return false;
  const ip = address.replace(/^::ffff:/i, '').split('%')[0].toLowerCase();
  if (!isIP(ip)) return false;
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
  const parts = ip.split('.').map(Number);
  if (parts.some((part) => part > 255)) return false;
  return (
    parts[0] === 127 ||
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254)
  );
}

function emptyStations() {
  return {
    s1_order: false,
    s2_rewrite: false,
    s2_vs_branch: false,
    s2_kettle: false,
    s3_timing: false,
    exam: false,
  };
}

function emptyS3() {
  return {
    faultObserved: false,
    scenario: 'car_heavy',
    strategy: '',
    reason: '',
    ruleChanged: false,
    revalidateOk: false,
  };
}

function emptyRelics() {
  return {
    quota: RELIC_QUOTA,
    used: 0,
    remaining: RELIC_QUOTA,
    unlockedRelics: { whistle: false, arrow: false, knob: false },
  };
}

function initialState(student) {
  return {
    student,
    startedAt: null,
    lastActiveAt: null,
    stations: emptyStations(),
    s3Detail: emptyS3(),
    relics: emptyRelics(),
    scaffoldHistory: [],
    examResult: null,
    examAnswers: null,
    rewardUnlocked: false,
    examOpen: false,
  };
}

function stationsOk(stations) {
  const s1 = !!stations.s1_order;
  const s2 = !!(stations.s2_rewrite && stations.s2_vs_branch && stations.s2_kettle);
  const s3 = !!stations.s3_timing;
  return { s1, s2, s3, all: s1 && s2 && s3 };
}

function createService(options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR || path.join(BASE, 'runtime');
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });

  const rosterPath =
    options.rosterPath ||
    process.env.ROSTER_PATH ||
    (fs.existsSync(path.join(BASE, 'roster', 'roster.json'))
      ? path.join(BASE, 'roster', 'roster.json')
      : path.join(BASE, 'roster.json'));
  const rosterSource = options.roster || JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  const roster = Array.isArray(rosterSource)
    ? rosterSource
    : (rosterSource.classes || []).flatMap((group) =>
        group.students.map((student) => ({ ...student, classId: group.id }))
      );

  const db = new DatabaseSync(path.join(dataDir, 'classroom.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY, classId TEXT NOT NULL, name TEXT NOT NULL, manual INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS states(studentId TEXT PRIMARY KEY, json TEXT NOT NULL, lastSync TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events(studentId TEXT NOT NULL, eventId TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(studentId, eventId));`);

  const rosterIds = new Set();
  const insertStudent = db.prepare(
    'INSERT INTO students VALUES(?,?,?,0) ON CONFLICT(id) DO UPDATE SET classId=excluded.classId,name=excluded.name,manual=0'
  );
  for (const student of roster) {
    if (
      !student.id ||
      !CLASSES.includes(String(student.classId)) ||
      typeof student.name !== 'string' ||
      !student.name.trim() ||
      rosterIds.has(String(student.id))
    ) {
      throw new Error('名单中的班级、学生标识或姓名不完整或重复');
    }
    rosterIds.add(String(student.id));
    insertStudent.run(String(student.id), String(student.classId), student.name.trim());
  }

  const now = () => new Date().toISOString();

  function studentById(id) {
    return db.prepare('SELECT id,classId,name,manual FROM students WHERE id=?').get(String(id || ''));
  }

  function allStudents() {
    return db
      .prepare('SELECT id,classId,name,manual FROM students ORDER BY classId,rowid')
      .all()
      .filter((student) => rosterIds.has(student.id) || student.manual);
  }

  function classes() {
    return CLASSES.map((id) => ({
      id,
      students: allStudents()
        .filter((student) => student.classId === id)
        .map(({ id: sid, name }) => ({ id: sid, name })),
    }));
  }

  function recordFor(id) {
    const row = db.prepare('SELECT * FROM states WHERE studentId=?').get(id);
    if (!row) return { state: null, lastSync: null, entered: false };
    return { state: JSON.parse(row.json), lastSync: row.lastSync, entered: true };
  }

  function save(id, state) {
    state.lastActiveAt = now();
    if (!state.startedAt) state.startedAt = state.lastActiveAt;
    const ok = stationsOk(state.stations);
    state.examOpen = ok.all || !!state.examResult;
    db.prepare(
      'INSERT INTO states VALUES(?,?,?) ON CONFLICT(studentId) DO UPDATE SET json=excluded.json,lastSync=excluded.lastSync'
    ).run(id, JSON.stringify(state), state.lastActiveAt);
    return state;
  }

  function publicStudent(row) {
    return { id: row.id, classId: row.classId, name: row.name, manual: !!row.manual };
  }

  function toClientStudent(row) {
    return {
      studentId: row.id,
      classId: row.classId,
      name: row.name,
      rosterIndex: -1,
      rosterSource: row.manual ? 'manual' : 'roster',
      isTest: false,
    };
  }

  function checkOrigin(req) {
    if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, '请从本课堂网址直接操作');
    if (req.headers.origin) {
      let origin;
      try {
        origin = new URL(req.headers.origin);
      } catch {
        fail(403, '来源网址无效');
      }
      if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== req.headers.host) {
        fail(403, '请从本课堂网址直接操作');
      }
    }
  }

  function teacherGuard(req) {
    // /teacher 免密；仅限制本机/局域网
    if (!isPrivateAddress(req.socket.remoteAddress)) fail(403, '教师入口仅开放给本机和局域网设备');
    checkOrigin(req);
  }

  function teacherData(classId) {
    if (classId && !CLASSES.includes(classId)) fail(400, '请选择五年级班级');
    const students = allStudents()
      .filter((student) => !classId || student.classId === classId)
      .map((student) => {
        const record = recordFor(student.id);
        const state = record.state;
        return {
          student: toClientStudent(student),
          entered: record.entered,
          lastSync: record.lastSync,
          stations: state?.stations || emptyStations(),
          relics: state?.relics || emptyRelics(),
          examResult: state?.examResult || null,
          rewardUnlocked: !!state?.rewardUnlocked,
          examOpen: !!state?.examOpen,
          s3Detail: state?.s3Detail || emptyS3(),
        };
      });

    const rosterTotal = classId
      ? allStudents().filter((s) => s.classId === classId && !s.manual).length ||
        classes().find((c) => c.id === classId)?.students.length ||
        0
      : rosterIds.size;

    const entered = students.filter((s) => s.entered).length;
    const s1 = students.filter((s) => s.stations.s1_order).length;
    const s2 = students.filter(
      (s) => s.stations.s2_rewrite && s.stations.s2_vs_branch && s.stations.s2_kettle
    ).length;
    const s3 = students.filter((s) => s.stations.s3_timing).length;
    const passed = students.filter((s) => s.examResult?.passed).length;
    const challengeBonus = students.filter((s) => s.examResult?.challengePassed).length;
    const relicUsed = students.reduce((sum, s) => sum + (s.relics?.used || 0), 0);

    return {
      appId: APP_ID,
      quizVersion: QUIZ_VERSION,
      updatedAt: now(),
      denominator: rosterTotal,
      classCounts: Object.fromEntries(
        CLASSES.map((id) => [id, allStudents().filter((s) => s.classId === id && !s.manual).length])
      ),
      classes: classes(),
      students,
      summary: {
        total: rosterTotal,
        entered,
        notEntered: rosterTotal - entered,
        s1,
        s2,
        s3,
        examPassed: passed,
        challengeBonus,
        relicUsed,
      },
    };
  }

  function exportCsv(classId) {
    const data = teacherData(classId);
    const headers = [
      '班级',
      '姓名',
      '学生ID',
      '是否登录',
      'S1过街顺序',
      'S2信号拆解',
      'S3时长调度',
      '基础考核得分',
      'G1得分(/5)',
      'G2得分(/3)',
      '是否达标',
      '挑战题得分(/6)',
      '挑战加分',
      '法宝已用(/3)',
    ];
    const lines = [headers.join(',')];
    for (const row of data.students) {
      const s2ok = row.stations.s2_rewrite && row.stations.s2_vs_branch && row.stations.s2_kettle;
      lines.push(
        [
          row.student.classId,
          `"${row.student.name}"`,
          `"${row.student.studentId}"`,
          row.entered ? '是' : '否',
          row.stations.s1_order ? '是' : '否',
          s2ok ? '是' : '否',
          row.stations.s3_timing ? '是' : '否',
          row.examResult?.baseScore ?? '',
          row.examResult?.g1Score ?? '',
          row.examResult?.g2Score ?? '',
          row.examResult ? (row.examResult.passed ? '达标' : '未达标') : '',
          row.examResult?.challengeScore ?? '',
          row.examResult?.challengePassed ? '是' : row.examResult ? '否' : '',
          row.relics?.used ?? 0,
        ].join(',')
      );
    }
    return lines.join('\n');
  }

  function json(res, status, data) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(data));
  }

  async function readBody(req) {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 256 * 1024) fail(413, '提交内容过大');
      chunks.push(chunk);
    }
    if (!chunks.length) return {};
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      fail(400, '提交格式不正确');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, '提交格式不正确');
    return body;
  }

  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
  };

  function sendFile(res, file, reqMethod) {
    const ext = path.extname(file);
    const size = fs.statSync(file).size;
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Content-Length': size,
      'Cache-Control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (reqMethod === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://classroom.local');
      const route = decodeURIComponent(url.pathname);

      if (route.startsWith('/api/teacher') || route === '/teacher') {
        // teacher pages + APIs: private LAN, no password
        if (route.startsWith('/api/teacher')) teacherGuard(req);
      }
      if (req.method === 'POST') checkOrigin(req);

      if (req.method === 'GET' && route === '/api/config') {
        return json(res, 200, {
          appId: APP_ID,
          quizVersion: QUIZ_VERSION,
          relicQuota: RELIC_QUOTA,
          passLine: { base: 13, baseTotal: 16, g1: 3, g2: 2, challenge: 4, challengeTotal: 6 },
          denominator: rosterIds.size,
        });
      }

      if (req.method === 'GET' && route === '/api/roster') {
        return json(res, 200, {
          classes: classes(),
          total: rosterIds.size,
          classCounts: Object.fromEntries(
            CLASSES.map((id) => [id, allStudents().filter((s) => s.classId === id && !s.manual).length])
          ),
        });
      }

      if (req.method === 'GET' && route === '/api/state') {
        const student = studentById(url.searchParams.get('studentId'));
        if (!student) fail(404, '学生身份不存在');
        const record = recordFor(student.id);
        const state = record.state || initialState(toClientStudent(student));
        return json(res, 200, { student: toClientStudent(student), state });
      }

      if (req.method === 'GET' && route === '/api/teacher') {
        return json(res, 200, teacherData(url.searchParams.get('classId')));
      }

      if (req.method === 'GET' && route === '/api/teacher/export.csv') {
        const csv = exportCsv(url.searchParams.get('classId'));
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="g5l7-teacher-export.csv"',
          'Cache-Control': 'no-store',
        });
        return res.end('\uFEFF' + csv);
      }

      if (req.method === 'POST' && route === '/api/login') {
        const body = await readBody(req);
        const classId = String(body.classId || '');
        if (!CLASSES.includes(classId)) fail(400, '请选择五年级班级');
        let student;
        if (body.studentId) {
          student = studentById(body.studentId);
          if (!student || student.classId !== classId) fail(400, '所选姓名与班级不一致');
        } else {
          if (typeof body.name !== 'string') fail(400, '请填写姓名');
          const name = body.name.trim().replace(/\s+/g, ' ');
          if (!name || name.length > 40 || /[\u0000-\u001f]/.test(name)) {
            fail(400, '姓名请输入1到40个可显示字符');
          }
          const matches = allStudents().filter((s) => s.classId === classId && s.name === name);
          if (matches.length > 1) fail(400, '本班有同名同学，请从名单选择对应身份');
          student = matches[0];
          if (!student) {
            const id = `manual-${crypto.createHash('sha256').update(`${classId}\0${name}`).digest('hex').slice(0, 24)}`;
            db.prepare('INSERT OR IGNORE INTO students VALUES(?,?,?,1)').run(id, classId, name);
            student = studentById(id);
          }
        }
        let record = recordFor(student.id);
        let state = record.state;
        if (!state) {
          state = initialState(toClientStudent(student));
          state.startedAt = now();
        }
        state.student = toClientStudent(student);
        state = save(student.id, state);
        return json(res, 200, { student: toClientStudent(student), state });
      }

      if (req.method === 'POST' && route === '/api/progress') {
        const body = await readBody(req);
        const student = studentById(body.studentId);
        if (!student) fail(400, '请先选择班级与姓名');
        const record = recordFor(student.id);
        const state = record.state || initialState(toClientStudent(student));
        if (body.stations && typeof body.stations === 'object') {
          state.stations = { ...state.stations, ...body.stations };
        }
        if (body.s3Detail && typeof body.s3Detail === 'object') {
          state.s3Detail = { ...state.s3Detail, ...body.s3Detail };
        }
        if (body.relics && typeof body.relics === 'object') {
          // clamp relic fields; quota locked to 3
          const used = Math.max(0, Math.min(RELIC_QUOTA, Number(body.relics.used) || 0));
          state.relics = {
            quota: RELIC_QUOTA,
            used,
            remaining: RELIC_QUOTA - used,
            unlockedRelics: {
              whistle: !!(body.relics.unlockedRelics?.whistle ?? state.relics.unlockedRelics.whistle),
              arrow: !!(body.relics.unlockedRelics?.arrow ?? state.relics.unlockedRelics.arrow),
              knob: !!(body.relics.unlockedRelics?.knob ?? state.relics.unlockedRelics.knob),
            },
          };
        }
        if (Array.isArray(body.scaffoldHistory)) {
          state.scaffoldHistory = body.scaffoldHistory.slice(-50);
        }
        if (typeof body.rewardUnlocked === 'boolean') {
          state.rewardUnlocked = body.rewardUnlocked || !!state.examResult?.passed;
        }
        const saved = save(student.id, state);
        return json(res, 200, { student: toClientStudent(student), state: saved });
      }

      if (req.method === 'POST' && route === '/api/relic') {
        const body = await readBody(req);
        const student = studentById(body.studentId);
        if (!student) fail(400, '请先选择班级与姓名');
        const record = recordFor(student.id);
        const state = record.state || initialState(toClientStudent(student));
        if (state.relics.remaining <= 0) fail(409, '通关法宝次数已用完');
        state.relics.used += 1;
        state.relics.remaining = Math.max(0, RELIC_QUOTA - state.relics.used);
        state.relics.quota = RELIC_QUOTA;
        const saved = save(student.id, state);
        return json(res, 200, { student: toClientStudent(student), state: saved, relics: saved.relics });
      }

      if (req.method === 'POST' && route === '/api/exam/submit') {
        const body = await readBody(req);
        const student = studentById(body.studentId);
        if (!student) fail(400, '请先选择班级与姓名');
        const eventId = typeof body.eventId === 'string' && body.eventId ? body.eventId : crypto.randomUUID();
        const previous = db.prepare('SELECT result FROM events WHERE studentId=? AND eventId=?').get(student.id, eventId);
        if (previous) {
          return json(res, 200, JSON.parse(previous.result));
        }
        const record = recordFor(student.id);
        const state = record.state || initialState(toClientStudent(student));
        const ok = stationsOk(state.stations);
        if (!ok.all && !state.examResult) fail(409, '请先完成三个探究站后再开考');
        if (!body.answers || typeof body.answers !== 'object') fail(400, '作答格式不正确');
        const result = evaluateAnswers(body.answers);
        // Persist first attempt answers; later submits update latest but keep first pass flag if already passed
        if (!state.examResult) {
          state.examAnswers = body.answers;
          state.examResult = result;
        } else {
          state.examAnswers = body.answers;
          state.examResult = result;
        }
        state.stations.exam = true;
        state.rewardUnlocked = !!result.passed;
        state.examOpen = true;
        const saved = save(student.id, state);
        const payload = { student: toClientStudent(student), state: saved, result };
        db.prepare('INSERT INTO events VALUES(?,?,?)').run(student.id, eventId, JSON.stringify(payload));
        return json(res, 200, payload);
      }

      if (route.startsWith('/api/')) fail(404, '接口不存在');

      if (!['GET', 'HEAD'].includes(req.method)) fail(405, '请求方法不支持');

      const distDir = path.join(BASE, 'dist');
      const publicDir = path.join(BASE, 'public');
      const spaRoutes = new Set(['/', '/teacher', '/index.html', '/teacher.html']);

      if (spaRoutes.has(route) || route === '/teacher/') {
        const indexFile = path.join(distDir, 'index.html');
        if (fs.existsSync(indexFile)) return sendFile(res, indexFile, req.method);
        // fallback: no build yet
        fail(503, '请先执行 npm run build 再启动课堂服务');
      }

      const name = route.slice(1);
      if (!name || name.split('/').some((part) => part.startsWith('.') || !part)) fail(404, '文件不存在');

      // godot/ 优先 public（重导 HTML5 包），避免 dist 旧包抢先；其余静态仍 dist→public
      const tryDirs = name === 'godot' || name.startsWith('godot/')
        ? [publicDir, distDir]
        : [distDir, publicDir];
      for (const root of tryDirs) {
        const file = path.join(root, name);
        if (
          fs.existsSync(file) &&
          fs.statSync(file).isFile() &&
          fs.realpathSync(file).startsWith(fs.realpathSync(root) + path.sep)
        ) {
          return sendFile(res, file, req.method);
        }
      }

      // SPA fallback for client-side routes when dist exists
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile) && !path.extname(name)) return sendFile(res, indexFile, req.method);
      fail(404, '文件不存在');
    } catch (error) {
      if (!res.headersSent) {
        json(res, error.status || (error instanceof URIError ? 400 : 500), {
          error: error.status || error instanceof URIError ? error.message : '课堂服务暂时无法处理请求，请重试',
          ...(error.code ? { code: error.code } : {}),
        });
      }
      if (!error.status && !(error instanceof URIError)) console.error(error);
    }
  });

  return {
    server,
    db,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          try {
            db.close();
          } catch (closeError) {
            error ||= closeError;
          }
          if (error) reject(error);
          else resolve();
        });
        server.closeIdleConnections?.();
      }),
  };
}

if (require.main === module) {
  const service = createService();
  const port = Number(process.env.PORT || DEFAULT_PORT);
  const host = process.env.HOST || '0.0.0.0';
  service.server.listen(port, host, () => {
    console.log(`莲花山智慧路口已启动： http://localhost:${port}`);
    console.log(`教师大屏： http://localhost:${port}/teacher （免密，仅局域网）`);
    console.log(`DATA_DIR=${process.env.DATA_DIR || path.join(BASE, 'runtime')}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => service.close().then(() => process.exit(0)));
  }
}

module.exports = { createService, isPrivateAddress, RELIC_QUOTA, APP_ID };
