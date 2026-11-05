'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createService } = require('./server.cjs');
const { BANK, evaluateAnswers } = require('./quiz.cjs');

const roster = require('./roster/roster.json');
const completed = {
  s1_order: true, s2_rewrite: true, s2_vs_branch: true, s2_kettle: true, s3_timing: true,
};
const validS3 = {
  faultObserved: true, scenario: 'car_heavy', strategy: 'longer_car', reason: 'reduce_wait',
  ruleChanged: true, revalidateOk: true,
};
const correctBase = Object.fromEntries(Object.entries(BANK.answers).filter(([id]) => id.startsWith('B')));
const correctChallenge = Object.fromEntries(Object.entries(BANK.answers).filter(([id]) => id.startsWith('C')));

async function fixture(t, customRoster = roster) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lotus-server-test-'));
  let service;
  let base;
  async function open() {
    service = createService({ dataDir, roster: customRoster });
    await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${service.server.address().port}`;
  }
  await open();
  t.after(async () => { await service.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  async function request(route, body, token, method) {
    const response = await fetch(`${base}${route}`, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = response.headers.get('content-type')?.includes('application/json')
      ? await response.json() : await response.text();
    return { status: response.status, data, response };
  }
  async function login(id = customRoster[0].id) {
    const res = await request('/api/login', { classId: '501', studentId: id });
    assert.equal(res.status, 200);
    return { id: res.data.student.studentId, token: res.data.sessionToken, state: res.data.state };
  }
  async function progress(student, patch) {
    return request('/api/progress', { studentId: student.id, ...patch }, student.token);
  }
  async function ready(student) {
    const res = await progress(student, { stations: completed, s3Detail: validS3 });
    assert.equal(res.status, 200);
    assert.equal(res.data.state.examOpen, true);
  }
  async function submit(student, answers, eventId) {
    return request('/api/exam/submit', { studentId: student.id, answers, eventId }, student.token);
  }
  return { request, login, progress, ready, submit,
    get service() { return service; },
    reopen: async () => { await service.close(); await open(); },
  };
}

test('student endpoints require a persistent token bound to the selected student', async t => {
  const f = await fixture(t);
  const a = await f.login();
  const b = await f.login(roster[1].id);
  assert.match(a.token, /^[a-f0-9]{64}$/);
  assert.notEqual(a.token, b.token);
  assert.equal(a.state.sessionToken, undefined);
  for (const [route, body] of [
    [`/api/state?studentId=${a.id}`, undefined],
    ['/api/progress', { studentId: a.id }],
    ['/api/relic', { studentId: a.id }],
    ['/api/exam/submit', { studentId: a.id, answers: {} }],
  ]) {
    assert.equal((await f.request(route, body)).status, 401, route);
    assert.equal((await f.request(route, body, 'invalid')).status, 401, route);
    assert.equal((await f.request(route, body, b.token)).status, 403, route);
  }
  await f.reopen();
  assert.equal((await f.request(`/api/state?studentId=${a.id}`, undefined, a.token)).status, 200);
});

test('three relic uses cannot be replenished by progress, station reset, or reopening SQLite', async t => {
  const f = await fixture(t);
  const a = await f.login();
  for (let i = 1; i <= 3; i++) {
    const res = await f.request('/api/relic', { studentId: a.id }, a.token);
    assert.equal(res.status, 200);
    assert.equal(res.data.state.relics.used, i);
  }
  const forged = await f.progress(a, {
    relics: { quota: 999, used: 0, remaining: 999, unlockedRelics: { whistle: true, arrow: true, knob: true } },
    rewardUnlocked: true, stations: { s1_order: false },
  });
  assert.equal(forged.data.state.relics.used, 3);
  assert.equal(forged.data.state.relics.remaining, 0);
  assert.equal(forged.data.state.relics.quota, 3);
  assert.deepEqual(forged.data.state.relics.unlockedRelics, { whistle: false, arrow: false, knob: false });
  assert.equal(forged.data.state.rewardUnlocked, false);
  assert.equal((await f.request('/api/relic', { studentId: a.id }, a.token)).status, 409);
  await f.reopen();
  const state = (await f.request(`/api/state?studentId=${a.id}`, undefined, a.token)).data.state;
  assert.equal(state.relics.used, 3);
  assert.equal((await f.request('/api/relic', { studentId: a.id }, a.token)).status, 409);
});

test('station input accepts only known boolean fields and exam status remains server owned', async t => {
  const f = await fixture(t);
  const a = await f.login();
  for (const stations of ['done', [], { s1_order: 'true' }, { arbitrary: true }]) {
    assert.equal((await f.progress(a, { stations })).status, 400);
  }
  const res = await f.progress(a, { stations: { exam: true }, rewardUnlocked: true });
  assert.equal(res.status, 200);
  assert.equal(res.data.state.stations.exam, false);
  assert.equal(res.data.state.rewardUnlocked, false);
  await f.progress(a, { stations: { s1_order: true } });
  const unlocked = (await f.request(`/api/state?studentId=${a.id}`, undefined, a.token)).data.state.relics.unlockedRelics;
  assert.deepEqual(unlocked, { whistle: true, arrow: false, knob: false });
});

test('exam requires the current three stations, including a revalidated S3 after rule changes', async t => {
  const f = await fixture(t);
  const a = await f.login();
  assert.equal((await f.submit(a, correctBase, 'before-stations')).status, 409);
  await f.ready(a);
  assert.equal((await f.submit(a, correctBase, 'first')).status, 200);
  let res = await f.progress(a, { stations: { s2_kettle: false } });
  assert.equal(res.data.state.examOpen, false);
  assert.equal((await f.submit(a, correctBase, 'after-reset')).status, 409);
  await f.ready(a);
  res = await f.progress(a, { s3Detail: { strategy: 'new-rule', ruleChanged: true, revalidateOk: false } });
  assert.equal(res.data.state.stations.s3_timing, false);
  assert.equal(res.data.state.examOpen, false);
  assert.equal((await f.submit(a, correctBase, 'unvalidated')).status, 409);
  await f.ready(a);
  res = await f.progress(a, { s3Detail: { strategy: 'another-rule' } });
  assert.equal(res.data.state.s3Detail.revalidateOk, false);
  assert.equal(res.data.state.examOpen, false);
  // A historical idempotency key cannot bypass the current station gate.
  assert.equal((await f.submit(a, correctBase, 'first')).status, 409);
});

test('raw evidence is appended, validated, deduplicated per student, and survives reopening', async t => {
  const f = await fixture(t);
  const a = await f.login();
  const evidence = { eventId: 'e1', taskId: 's2_rewrite', correct: false, payload: { diamond: '尝试答案', revision: 1 }, attemptKind: 'first' };
  assert.equal((await f.progress(a, { evidence })).status, 200);
  assert.equal((await f.progress(a, { evidence })).status, 200);
  const res = await f.progress(a, { evidence: { studentId: '', classId: '', runId: '', taskId: 's2_rewrite', correct: true, payload: { diamond: '修订答案' } } });
  assert.equal(res.status, 200);
  for (const invalid of [[], { taskId: 'unknown', correct: true }, { taskId: 's1_order', correct: 'true' }, { taskId: 's1_order', correct: true, payload: [] }]) {
    assert.equal((await f.progress(a, { evidence: invalid })).status, 400);
  }
  const b = await f.login(roster[1].id);
  assert.equal((await f.progress(b, { evidence })).status, 200);
  await f.reopen();
  const teacher = (await f.request('/api/teacher')).data;
  const rows = teacher.students.find(row => row.student.studentId === a.id).evidence;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].payload.diamond, '尝试答案');
  assert.equal(rows[0].correct, false);
  for (const row of rows) {
    assert.equal(row.studentId, a.id);
    assert.equal(row.classId, '501');
    assert.equal(row.runId, a.id);
  }
  assert.match(rows[1].eventId, /^[a-f0-9-]{36}$/);
  assert.equal(teacher.students.find(row => row.student.studentId === b.id).evidence.length, 1);
  assert.equal((await f.progress(a, { evidence: { ...evidence, studentId: b.id } })).status, 403);
});

test('base and challenge first answers freeze independently, with latest retained for review', async t => {
  const f = await fixture(t);
  const a = await f.login();
  await f.ready(a);
  let res = await f.submit(a, { B01: '错误' }, 'base-first');
  assert.equal(res.data.result.baseScore, 0);
  assert.equal(res.data.result.passed, false);
  assert.equal(res.data.state.challengeFirstResult, null);
  assert.deepEqual(res.data.result.details, [], 'students do not receive grading details');
  res = await f.submit(a, { ...correctBase, ...correctChallenge }, 'challenge-first');
  assert.equal(res.data.result.baseScore, 0, 'later full submissions cannot replace base first');
  assert.equal(res.data.result.passed, false);
  assert.equal(res.data.result.challengeScore, 6);
  assert.equal(res.data.result.challengePassed, true);
  assert.equal(res.data.state.rewardUnlocked, false);
  assert.equal(res.data.state.examLatestResult.baseScore, 16);
  assert.equal(res.data.state.examFirstAnswers.B01, '错误');
  res = await f.submit(a, { ...correctBase, C01: '错误' }, 'challenge-retry');
  assert.equal(res.data.result.challengeScore, 6);
  assert.equal(res.data.state.examLatestResult.challengeScore, 0);
  assert.equal(res.data.state.examAnswers.C01, '错误');
  const teacher = (await f.request('/api/teacher')).data.students.find(row => row.student.studentId === a.id);
  assert.equal(teacher.examFirstResult.baseScore, 0);
  assert.equal(teacher.examLatestResult.baseScore, 16);
  assert.equal(teacher.challengeFirstResult.challengeScore, 6);
  assert.equal(teacher.examResult.details.filter(row => row.tier === 'challenge' && row.correct).length, 6);
  await f.reopen();
  res = await f.submit(a, correctBase, 'after-reopen');
  assert.equal(res.data.result.baseScore, 0);
  assert.equal(res.data.result.challengeScore, 6);
  assert.equal(f.service.db.prepare('SELECT COUNT(*) AS count FROM events WHERE studentId=?').get(a.id).count, 4);
});

test('successful base first remains successful and duplicate exam events do not append', async t => {
  const f = await fixture(t);
  const a = await f.login();
  await f.ready(a);
  await f.submit(a, correctBase, 'pass-first');
  let res = await f.submit(a, { B01: '错误', C01: '错误' }, 'retry');
  assert.equal(res.data.result.baseScore, 16);
  assert.equal(res.data.result.passed, true);
  assert.equal(res.data.state.rewardUnlocked, true);
  assert.equal(res.data.result.challengeScore, 0);
  res = await f.submit(a, { ...correctBase, ...correctChallenge }, 'retry');
  assert.equal(res.data.result.challengeScore, 0);
  assert.equal(f.service.db.prepare('SELECT COUNT(*) AS count FROM events WHERE studentId=?').get(a.id).count, 2);
});

test('an event insert failure rolls back its state update', async t => {
  const f = await fixture(t);
  const a = await f.login();
  await f.ready(a);
  f.service.db.exec("CREATE TRIGGER reject_exam BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT, 'test rejection'); END;");
  assert.equal((await f.submit(a, correctBase, 'rejected')).status, 500);
  const state = (await f.request(`/api/state?studentId=${a.id}`, undefined, a.token)).data.state;
  assert.equal(state.examResult, null);
  assert.equal(state.rewardUnlocked, false);
  assert.equal(state.stations.exam, false);
});

test('teacher totals use only the authoritative 212-student roster, while manual students remain visible', async t => {
  const f = await fixture(t);
  const a = await f.login();
  const login = await f.request('/api/login', { classId: '501', name: '=SUM(1,2)' });
  assert.equal(login.status, 200);
  const manual = { id: login.data.student.studentId, token: login.data.sessionToken };
  await f.ready(manual);
  await f.submit(manual, { ...correctBase, ...correctChallenge }, 'manual-exam');
  const data = (await f.request('/api/teacher')).data;
  assert.equal(data.denominator, 212);
  assert.equal(data.students.length, 213);
  assert.deepEqual(data.summary, {
    total: 212, entered: 1, notEntered: 211, s1: 0, s2: 0, s3: 0, examPassed: 0, challengeBonus: 0, relicUsed: 0,
  });
  const classData = (await f.request('/api/teacher?classId=501')).data;
  const classTotal = roster.filter(row => row.classId === '501').length;
  assert.equal(classData.denominator, classTotal);
  assert.equal(classData.summary.entered, 1);
  assert.equal(classData.summary.notEntered, classTotal - 1);
});

test('CSV escapes embedded quotes and line breaks and neutralizes formula names', async t => {
  const customRoster = [{ id: 'student-1', classId: '501', name: '姓名"引号\n换行' }];
  const f = await fixture(t, customRoster);
  await f.request('/api/login', { classId: '501', name: '=SUM(1,2)' });
  const csv = (await f.request('/api/teacher/export.csv')).data;
  assert.ok(csv.includes('"姓名""引号\n换行"'));
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
});

test('static WASM uses its browser MIME type and design or answer sources are not student resources', async t => {
  const f = await fixture(t);
  const wasm = await f.request('/godot/index.wasm', undefined, undefined, 'HEAD');
  assert.equal(wasm.status, 200);
  assert.equal(wasm.response.headers.get('content-type'), 'application/wasm');
  for (const route of ['/quiz.cjs', '/server.cjs', '/design/03_questions.json', '/design/05_data-schema.json', '/assets/aistudio/05___________5a881386.md']) {
    assert.equal((await f.request(route)).status, 404, route);
  }
  const studentQuestions = await f.request('/assets/aistudio/03_questions_student_b0160749.json');
  assert.equal(studentQuestions.status, 200);
  assert.equal(studentQuestions.data.answers, undefined);
  for (const question of studentQuestions.data.questions) {
    assert.equal(question.answer, undefined);
    assert.equal(question.analysis, undefined);
    assert.equal(question.misconceptionMap, undefined);
  }
});

test('base pass thresholds and independent challenge first results use the agreed boundary values', async t => {
  const f = await fixture(t);
  const cases = [
    { omit: ['B04', 'B05', 'B10'], baseScore: 13, passed: true, challengeCount: 4, challengePassed: true },
    { omit: ['B04', 'B05', 'B10', 'B07'], baseScore: 12, passed: false, challengeCount: 3, challengePassed: false },
    { omit: ['B01', 'B02', 'B03'], baseScore: 13, g1Score: 2, passed: false, challengeCount: 0, challengePassed: false },
    { omit: ['B13', 'B14'], baseScore: 14, g2Score: 1, passed: false, challengeCount: 0, challengePassed: false },
    { omit: ['B01', 'B02', 'B13'], baseScore: 13, g1Score: 3, g2Score: 2, passed: true, challengeCount: 0, challengePassed: false },
  ];
  for (let i = 0; i < cases.length; i++) {
    const item = cases[i];
    const student = await f.login(roster[i].id);
    await f.ready(student);
    const answers = Object.fromEntries(Object.entries(correctBase).filter(([id]) => !item.omit.includes(id)));
    Object.assign(answers, Object.fromEntries(Object.entries(correctChallenge).slice(0, item.challengeCount)));
    const res = await f.submit(student, answers, `threshold-${i}`);
    assert.equal(res.status, 200);
    for (const key of ['baseScore', 'passed', 'g1Score', 'g2Score', 'challengePassed']) {
      if (item[key] !== undefined) assert.equal(res.data.result[key], item[key], `${i}:${key}`);
    }
    assert.equal(res.data.result.challengeScore, item.challengeCount);
    assert.equal(res.data.state.rewardUnlocked, item.passed);
  }
});

test('an explicitly submitted empty challenge freezes zero, while base-only submissions do not freeze challenge', async t => {
  const f = await fixture(t);
  const a = await f.login();
  await f.ready(a);
  let res = await f.request('/api/exam/submit', {
    studentId: a.id, tier: 'base', answers: { ...correctBase, ...correctChallenge }, eventId: 'base-with-c-keys',
  }, a.token);
  assert.equal(res.status, 200);
  assert.equal(res.data.state.challengeFirstResult, null);
  res = await f.request('/api/exam/submit', {
    studentId: a.id, tier: 'challenge', answers: {}, eventId: 'empty-challenge',
  }, a.token);
  assert.equal(res.status, 200);
  assert.equal(res.data.state.challengeFirstResult.challengeScore, 0);
  res = await f.request('/api/exam/submit', {
    studentId: a.id, tier: 'challenge', answers: { ...correctBase, ...correctChallenge }, eventId: 'challenge-revise',
  }, a.token);
  assert.equal(res.data.result.challengeScore, 0);
  assert.equal(res.data.result.challengePassed, false);
  assert.equal(res.data.result.baseScore, 16);
  assert.equal(res.data.state.examLatestResult.challengeScore, 6);
});

test('explicit challenge requires a prior base first submission and invalid tiers are rejected', async t => {
  const f = await fixture(t);
  const a = await f.login();
  await f.ready(a);
  let res = await f.request('/api/exam/submit', {
    studentId: a.id, tier: 'challenge', answers: correctChallenge, eventId: 'too-early',
  }, a.token);
  assert.equal(res.status, 409);
  assert.equal(f.service.db.prepare('SELECT COUNT(*) AS count FROM events').get().count, 0);
  res = await f.request('/api/exam/submit', {
    studentId: a.id, tier: 'unexpected', answers: correctBase,
  }, a.token);
  assert.equal(res.status, 400);
  const state = (await f.request(`/api/state?studentId=${a.id}`, undefined, a.token)).data.state;
  assert.equal(state.examFirstResult, null);
});

test('legacy SQLite histories recover the original first base and challenge independently', async t => {
  const f = await fixture(t);
  const a = await f.login();
  await f.ready(a);
  const legacy = JSON.parse(f.service.db.prepare('SELECT json FROM states WHERE studentId=?').get(a.id).json);
  for (const key of ['examFirstResult', 'challengeFirstResult', 'examLatestResult', 'examFirstAnswers', 'challengeFirstAnswers']) delete legacy[key];
  const attempts = [
    { B01: '首次错误' },
    { ...correctBase, C01: '挑战首次错误' },
    { ...correctBase, ...correctChallenge },
  ];
  for (let i = 0; i < attempts.length; i++) {
    legacy.examAnswers = attempts[i];
    legacy.examResult = evaluateAnswers(attempts[i]);
    const payload = { student: legacy.student, state: legacy, result: legacy.examResult };
    f.service.db.prepare('INSERT INTO events VALUES(?,?,?)').run(a.id, `legacy-${i}`, JSON.stringify(payload));
  }
  f.service.db.prepare('UPDATE states SET json=? WHERE studentId=?').run(JSON.stringify(legacy), a.id);
  await f.reopen();
  const state = (await f.request(`/api/state?studentId=${a.id}`, undefined, a.token)).data.state;
  assert.equal(state.examResult.baseScore, 0);
  assert.equal(state.examResult.challengeScore, 0);
  assert.equal(state.examFirstAnswers.B01, '首次错误');
  assert.equal(state.challengeFirstAnswers.C01, '挑战首次错误');
  assert.equal(state.examLatestResult.baseScore, 16);
  assert.equal(state.examLatestResult.challengeScore, 6);
});
