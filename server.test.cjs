'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createService } = require('./server.cjs');
const { BANK, answerScalar, evaluateAnswers } = require('./quiz.cjs');

const roster = [53, 53, 52, 54].flatMap((count, index) => Array.from({ length: count }, (_, student) => ({
  id: `synthetic-${index}-${student}`, classId: String(501 + index), name: `虚构学生${index}-${student}`,
})));
const completed = {
  s1_order: true, s2_rewrite: true, s2_vs_branch: true, s2_kettle: true, s3_timing: true,
};
const validS3 = {
  faultObserved: true, scenario: 'car_heavy', strategy: 'longer_car', reason: 'reduce_wait',
  ruleChanged: true, revalidateOk: true,
};
const correctBase = Object.fromEntries(Object.entries(BANK.answers).filter(([id]) => id.startsWith('B')));
const correctChallenge = Object.fromEntries(Object.entries(BANK.answers).filter(([id]) => id.startsWith('C')));

function wrongChoice(id) {
  const question = BANK.questions.find(item => item.id === id);
  return (question.options || question.cards).find(choice => choice !== answerScalar(BANK.answers[id]));
}

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
    ['/api/evidence', { studentId: a.id, evidence: {} }],
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

test('retrying a confirmed relic request uses only one of the three chances', async t => {
  const f = await fixture(t);
  const a = await f.login();
  const use = eventId => f.request('/api/relic', { studentId: a.id, eventId }, a.token);
  const [first, retry] = await Promise.all([use('same-press'), use('same-press')]);
  for (const result of [first, retry]) {
    assert.equal(result.status, 200);
    assert.equal(result.data.state.relics.remaining, 2);
  }
  await f.reopen();
  assert.equal((await use('same-press')).data.state.relics.remaining, 2);
  assert.equal((await use('second-press')).data.state.relics.remaining, 1);
  assert.equal((await use('third-press')).data.state.relics.remaining, 0);
  assert.equal((await use('same-press')).status, 200);
  assert.equal((await use('fourth-press')).status, 409);
});

test('class pause persists across restart, blocks new submissions, and preserves earned eligibility', async t => {
  const f = await fixture(t);
  const student = await f.login();
  await f.ready(student);
  const pause = await f.request('/api/teacher/exam-close', { classId: '501', closed: true });
  assert.equal(pause.status, 200);
  assert.equal(pause.data.closed, true);
  await f.reopen();
  const { data: { state } } = await f.request(`/api/state?studentId=${student.id}`, undefined, student.token);
  assert.equal(state.examPaused, true);
  assert.equal(state.examOpen, true);
  assert.equal((await f.submit(student, correctBase, 'paused-exam')).status, 409);
  const reopened = await f.request('/api/teacher/exam-close', { classId: '501', closed: false });
  assert.equal(reopened.data.closed, false);
  assert.equal((await f.submit(student, correctBase, 'reopened-exam')).status, 200);
});

test('exam opens after current stations pass and stays available after later edits', async t => {
  const f = await fixture(t);
  const a = await f.login();
  assert.equal((await f.submit(a, correctBase, 'before-stations')).status, 409);
  let res = await f.progress(a, { stations: completed, s3Detail: { ...validS3, revalidateOk: false } });
  assert.equal(res.data.state.examOpen, false);
  assert.equal((await f.submit(a, correctBase, 'before-validation')).status, 409);
  await f.ready(a);
  assert.equal((await f.submit(a, correctBase, 'first')).status, 200);
  res = await f.progress(a, { stations: { s2_kettle: false } });
  assert.equal(res.data.state.examOpen, true);
  assert.equal((await f.submit(a, correctBase, 'after-reset')).status, 200);
  res = await f.progress(a, { s3Detail: { strategy: 'new-rule', ruleChanged: true, revalidateOk: false } });
  assert.equal(res.data.state.stations.s3_timing, false);
  assert.equal(res.data.state.examOpen, true);
  assert.equal((await f.submit(a, correctBase, 'after-rule-edit')).status, 200);
  await f.reopen();
  const state = (await f.request(`/api/state?studentId=${a.id}`, undefined, a.token)).data.state;
  assert.equal(state.stations.s3_timing, false);
  assert.equal(state.examOpen, true);
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
  const firstWrong = { ...correctBase, B01: wrongChoice('B01'), B02: wrongChoice('B02'), B03: wrongChoice('B03') };
  let res = await f.submit(a, firstWrong, 'base-first');
  assert.equal(res.status, 200);
  assert.equal(res.data.result.baseScore, 13);
  assert.equal(res.data.result.passed, false);
  assert.equal(res.data.state.challengeFirstResult, null);
  assert.deepEqual(res.data.result.details, [], 'internal grading details stay private');
  assert.equal(res.data.state.examFeedback.base.length, 16);
  assert.equal(res.data.state.examFeedback.challenge, undefined);
  assert.equal(res.data.submittedFeedback, undefined);
  assert.equal(res.data.feedbackSession, undefined);
  res = await f.submit(a, { ...correctBase, ...correctChallenge }, 'challenge-first');
  assert.equal(res.data.result.baseScore, 13, 'later full submissions cannot replace base first');
  assert.equal(res.data.result.passed, false);
  assert.equal(res.data.result.challengeScore, 6);
  assert.equal(res.data.result.challengePassed, true);
  assert.equal(res.data.state.rewardUnlocked, true, 'reward uses the effective first base score, independent of per-goal passing');
  assert.equal(res.data.state.examLatestResult.baseScore, 16);
  assert.equal(res.data.state.examFirstAnswers.B01, firstWrong.B01);
  const wrongChallenge = Object.fromEntries(Object.keys(correctChallenge).map(id => [id, wrongChoice(id)]));
  res = await f.request('/api/exam/submit', {
    studentId: a.id, tier: 'challenge', answers: wrongChallenge, eventId: 'challenge-retry',
  }, a.token);
  assert.equal(res.status, 200);
  assert.equal(res.data.result.challengeScore, 6);
  assert.equal(res.data.state.examLatestResult.challengeScore, 0);
  assert.equal(res.data.state.examAnswers.C01, wrongChallenge.C01);
  assert.equal(res.data.state.examFeedback.base, undefined, 'reply only reveals the tier just submitted');
  const teacher = (await f.request('/api/teacher')).data.students.find(row => row.student.studentId === a.id);
  assert.equal(teacher.examFirstResult.baseScore, 13);
  assert.equal(teacher.examLatestResult.baseScore, 16);
  assert.equal(teacher.challengeFirstResult.challengeScore, 6);
  assert.equal(teacher.examResult.details.filter(row => row.tier === 'challenge' && row.correct).length, 6);
  await f.reopen();
  res = await f.submit(a, correctBase, 'after-reopen');
  assert.equal(res.data.result.baseScore, 13);
  assert.equal(res.data.result.challengeScore, 6);
  assert.equal(f.service.db.prepare('SELECT COUNT(*) AS count FROM events WHERE studentId=?').get(a.id).count, 4);
});

test('successful base first remains successful and duplicate exam events do not append', async t => {
  const f = await fixture(t);
  const a = await f.login();
  await f.ready(a);
  await f.submit(a, correctBase, 'pass-first');
  let res = await f.submit(a, { ...correctBase, B01: wrongChoice('B01') }, 'retry');
  assert.equal(res.status, 200);
  assert.equal(res.data.result.baseScore, 16);
  assert.equal(res.data.result.passed, true);
  assert.equal(res.data.state.rewardUnlocked, true);
  assert.equal(res.data.result.challengeScore, 0);
  res = await f.submit(a, { ...correctBase, ...correctChallenge }, 'retry');
  assert.equal(res.data.result.challengeScore, 0);
  assert.equal(res.data.state.examFeedback.base.length, 16);
  assert.equal(res.data.state.examFeedback.challenge, undefined);
  const anotherSession = await f.login();
  assert.equal(anotherSession.state.examFeedback, undefined);
  const current = await f.request(`/api/state?studentId=${a.id}`, undefined, anotherSession.token);
  assert.equal(current.data.state.examFeedback, undefined);
  const replay = await f.submit(anotherSession, correctBase, 'retry');
  assert.equal(replay.status, 200);
  assert.equal(replay.data.state.examFeedback, undefined);
  assert.equal(replay.data.submittedFeedback, undefined);
  assert.equal(replay.data.feedbackSession, undefined);
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
    for (const row of question.rows || []) assert.equal(row.answer, undefined);
  }
});

test('base pass thresholds and independent challenge first results use the agreed boundary values', async t => {
  const f = await fixture(t);
  const cases = [
    { omit: ['B04', 'B05', 'B10'], baseScore: 13, passed: true, challengeCount: 4, challengePassed: true },
    { omit: ['B04', 'B05', 'B10', 'B07'], baseScore: 12, passed: false, challengeCount: 3, challengePassed: false },
    { omit: ['B01', 'B02', 'B03'], baseScore: 13, g1Score: 2, passed: false, challengeCount: 0, challengePassed: false },
    { omit: ['B13', 'B14'], baseScore: 14, g2Score: 6, passed: true, challengeCount: 0, challengePassed: false },
    { omit: ['B01', 'B02', 'B13'], baseScore: 13, g1Score: 3, g2Score: 7, passed: true, challengeCount: 0, challengePassed: false },
  ];
  for (let i = 0; i < cases.length; i++) {
    const item = cases[i];
    const student = await f.login(roster[i].id);
    await f.ready(student);
    const answers = Object.fromEntries(Object.entries(correctBase).map(([id, value]) => [id, item.omit.includes(id) ? wrongChoice(id) : value]));
    const challenge = Object.entries(correctChallenge).map(([id, value], index) => [id, index < item.challengeCount ? value : wrongChoice(id)]);
    Object.assign(answers, Object.fromEntries(challenge));
    const res = await f.submit(student, answers, `threshold-${i}`);
    assert.equal(res.status, 200);
    for (const key of ['baseScore', 'passed', 'g1Score', 'g2Score', 'challengePassed']) {
      if (item[key] !== undefined) assert.equal(res.data.result[key], item[key], `${i}:${key}`);
    }
    assert.equal(res.data.result.challengeScore, item.challengeCount);
    assert.equal(res.data.state.rewardUnlocked, item.baseScore >= 13);
  }
});

test('empty, partial or malformed exams do not freeze a first score or reveal answers', async t => {
  const f = await fixture(t);
  const a = await f.login();
  await f.ready(a);
  const submit = (tier, answers, eventId) => f.request('/api/exam/submit', {
    studentId: a.id, tier, answers, eventId,
  }, a.token);
  const invalidBase = [
    [{}, 'EXAM_INCOMPLETE'],
    [{ ...correctBase, B16: { '等绿灯过街': correctBase.B16['等绿灯过街'] } }, 'EXAM_INCOMPLETE'],
    [{ ...correctBase, B16: { ...correctBase.B16, fabricated: 'injected' } }, 'EXAM_ANSWER_INVALID'],
    [{ ...correctBase, B04: { repeatRect: answerScalar(correctBase.B04) } }, 'EXAM_ANSWER_INVALID'],
  ];
  for (let i = 0; i < invalidBase.length; i++) {
    const [answers, code] = invalidBase[i];
    const result = await submit('base', answers, `bad-base-${i}`);
    assert.equal(result.status, 400);
    assert.equal(result.data.code, code);
    assert.equal(result.data.state, undefined);
  }
  const before = (await f.request(`/api/state?studentId=${a.id}`, undefined, a.token)).data.state;
  assert.equal(before.examFirstResult, null);
  assert.equal(before.examFeedback, undefined);
  assert.equal(f.service.db.prepare('SELECT COUNT(*) AS count FROM events').get().count, 0);
  let res = await f.request('/api/exam/submit', {
    studentId: a.id, tier: 'base', answers: { ...correctBase, ...correctChallenge }, eventId: 'base-with-c-keys',
  }, a.token);
  assert.equal(res.status, 200);
  assert.equal(res.data.state.challengeFirstResult, null);
  assert.equal(res.data.state.examFeedback.challenge, undefined);
  res = await f.request('/api/exam/submit', {
    studentId: a.id, tier: 'challenge', answers: {}, eventId: 'empty-challenge',
  }, a.token);
  assert.equal(res.status, 400);
  assert.equal(res.data.code, 'EXAM_INCOMPLETE');
  assert.equal(f.service.db.prepare('SELECT COUNT(*) AS count FROM events').get().count, 1);
  res = await f.request('/api/exam/submit', {
    studentId: a.id, tier: 'challenge', answers: { ...correctBase, ...correctChallenge }, eventId: 'challenge-revise',
  }, a.token);
  assert.equal(res.status, 200);
  assert.equal(res.data.result.challengeScore, 6);
  assert.equal(res.data.result.challengePassed, true);
  assert.equal(res.data.result.baseScore, 16);
  assert.equal(res.data.state.examLatestResult.challengeScore, 6);
  assert.equal(res.data.state.examFeedback.challenge.length, 6);
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
  const early = await f.request('/api/exam/submit', {
    studentId: a.id, tier: 'challenge', answers: correctChallenge, eventId: 'legacy-before-valid-base',
  }, a.token);
  assert.equal(early.status, 409);
  const base = await f.submit(a, correctBase, 'legacy-replace-base');
  assert.equal(base.status, 200);
  assert.equal(base.data.state.examFirstResult.baseScore, 16);
  assert.equal(base.data.state.legacyIncompleteExam, undefined);
  const archive = () => JSON.parse(f.service.db.prepare('SELECT json FROM states WHERE studentId=?').get(a.id).json).legacyIncompleteExam;
  assert.equal(archive().base.result.baseScore, 0);
  assert.equal(archive().base.answers.B01, '首次错误');
  const challenge = await f.request('/api/exam/submit', {
    studentId: a.id, tier: 'challenge', answers: correctChallenge, eventId: 'legacy-replace-challenge',
  }, a.token);
  assert.equal(challenge.status, 200);
  assert.equal(challenge.data.state.challengeFirstResult.challengeScore, 6);
  assert.equal(challenge.data.state.legacyIncompleteExam, undefined);
  assert.equal(archive().challenge.result.challengeScore, 0);
  assert.equal(archive().challenge.answers.C01, '挑战首次错误');
  assert.equal(f.service.db.prepare('SELECT COUNT(*) AS count FROM events WHERE studentId=?').get(a.id).count, 5);
});
