'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createService } = require('./server.cjs');

test('station attempts and runs survive restart, and the first station unlocks the exam', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lotus-evidence-'));
  const roster = [{ id: 'fake-1', classId: '501', name: '虚构学生' }];
  let service;
  const start = async () => {
    service = createService({ dataDir, roster });
    await new Promise((resolve) => service.server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${service.server.address().port}`;
  };
  try {
    let base = await start();
    const tokens = {};
    async function post(route, body) {
      const res = await fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json', ...(tokens[body.studentId] ? { Authorization: `Bearer ${tokens[body.studentId]}` } : {}) }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.sessionToken) tokens[json.student.studentId] = json.sessionToken;
      assert.equal(res.status, 200, JSON.stringify(json));
      return json.state;
    }
    await post('/api/login', { classId: '501', studentId: 'fake-1' });
    const record = (evidence) => post('/api/evidence', { studentId: 'fake-1', evidence });
    let state = await record({ eventId: 'a', taskId: 's2_rewrite', eventType: 'evidence_attempt', correct: false, payload: { choice: 'wrong' } });
    assert.equal(state.stations.s1_order, false);
    assert.equal(state.evidenceHistory[0].attemptKind, 'first');
    state = await record({ eventId: 'b', taskId: 's2_rewrite', eventType: 'scenario_run', payload: { scenario: 'red_then_green', result: 'wait_then_cross' } });
    assert.equal(state.evidenceHistory[1].attemptKind, 'process');
    state = await record({ eventId: 'c', taskId: 's2_rewrite', eventType: 'evidence_lock', correct: true, payload: { choice: 'fixed' } });
    assert.equal(state.evidenceHistory[2].attemptKind, 'revision');
    assert.equal(state.stations.s1_order, true);
    assert.equal(state.stations.s2_rewrite, true);
    const lockedVersion = state.stateVersion;
    state = await record({ eventId: 'c', taskId: 's2_rewrite', eventType: 'evidence_lock', correct: true, payload: { choice: 'fixed' } });
    assert.equal(state.evidenceHistory.length, 3);
    assert.equal(state.stateVersion, lockedVersion, 'duplicate events keep the same state revision');
    for (const taskId of ['s2_vs_branch', 's2_kettle']) {
      state = await record({ eventId: taskId, taskId, eventType: 'evidence_lock', correct: true, payload: {} });
    }
    state = await record({ eventId: 's3-run-1', taskId: 's3_timing', eventType: 'simulation_run', payload: { kind: 'attempt', correct: false, remainingCars: 9 } });
    assert.equal(state.evidenceHistory.at(-1).attemptKind, 'first');
    assert.equal(state.evidenceHistory.at(-1).correct, false);
    assert.equal(state.stations.s3_timing, false);
    state = await record({ eventId: 's3-run-2', taskId: 's3_timing', eventType: 'simulation_run', payload: { kind: 'attempt', correct: true, remainingCars: 6 } });
    assert.equal(state.evidenceHistory.at(-1).attemptKind, 'revision');
    assert.equal(state.evidenceHistory.at(-1).correct, true);
    state = await record({ eventId: 's3-final', taskId: 's3_timing', eventType: 'evidence_lock', correct: true, payload: {}, s3Detail: { faultObserved: true, scenario: 'car_heavy', strategy: 'st_car_long', reason: 'rs_evacuate', ruleChanged: true, revalidateOk: true } });
    assert.equal(state.evidenceHistory.at(-1).attemptKind, 'confirmation');
    assert.equal(state.examOpen, true);
    assert.ok(state.stateVersion > lockedVersion, 'new state can be distinguished from an earlier network response');
    const finalVersion = state.stateVersion;
    await service.close();
    base = await start();
    const response = await fetch(`${base}/api/state?studentId=fake-1`, { headers: { Authorization: `Bearer ${tokens['fake-1']}` } });
    state = (await response.json()).state;
    assert.equal(state.examOpen, true);
    assert.equal(state.evidenceHistory.length, 8);
    assert.equal(state.stateVersion, finalVersion);
    assert.deepEqual(state.evidenceHistory[1].payload, { scenario: 'red_then_green', result: 'wait_then_cross' });
    const teacher = await (await fetch(`${base}/api/teacher`)).json();
    assert.equal(teacher.students[0].evidenceHistory.length, 8);
    assert.equal(teacher.students[0].evidence.length, 8, 'the teacher evidence table receives the same timeline');
    assert.equal(teacher.students[0].evidence[0].studentId, 'fake-1');
  } finally {
    await service?.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('new evidence route enforces student identity, validates data, and rolls back a rejected insert', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lotus-evidence-auth-'));
  const service = createService({ dataDir, roster: [
    { id: 'auth-a', classId: '501', name: '虚构鉴权甲' },
    { id: 'auth-b', classId: '501', name: '虚构鉴权乙' },
  ] });
  try {
    await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${service.server.address().port}`;
    const send = async (route, body, token) => {
      const response = await fetch(base + route, { method: 'POST', headers: {
        'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }, body: JSON.stringify(body) });
      return { status: response.status, data: await response.json() };
    };
    const a = (await send('/api/login', { classId: '501', studentId: 'auth-a' })).data;
    const b = (await send('/api/login', { classId: '501', studentId: 'auth-b' })).data;
    const evidence = { eventId: 'auth-event', taskId: 's2_rewrite', eventType: 'evidence_lock', correct: true };
    const body = { studentId: 'auth-a', evidence };
    assert.equal((await send('/api/evidence', body)).status, 401);
    assert.equal((await send('/api/evidence', body, b.sessionToken)).status, 403);
    assert.equal((await send('/api/evidence', { ...body, evidence: { ...evidence, studentId: 'auth-b' } }, a.sessionToken)).status, 403);
    assert.equal((await send('/api/evidence', { ...body, evidence: { ...evidence, correct: 'true' } }, a.sessionToken)).status, 400);
    assert.equal((await send('/api/evidence', { ...body, evidence: { ...evidence, payload: { text: 'x'.repeat(33000) } } }, a.sessionToken)).status, 413);
    service.db.exec("CREATE TRIGGER reject_evidence BEFORE INSERT ON evidence BEGIN SELECT RAISE(ABORT, 'test evidence rejection'); END;");
    assert.equal((await send('/api/evidence', body, a.sessionToken)).status, 500);
    const state = JSON.parse(service.db.prepare('SELECT json FROM states WHERE studentId=?').get('auth-a').json);
    assert.equal(state.stations.s1_order, false);
    assert.equal(state.evidenceHistory.length, 0);
    assert.equal(state.stateVersion, a.state.stateVersion);
    assert.equal(service.db.prepare('SELECT COUNT(*) AS count FROM evidence').get().count, 0);
  } finally {
    await service.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('older student records keep unknown first attempts instead of inventing them', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lotus-old-evidence-'));
  const service = createService({ dataDir, roster: [{ id: 'old-fake', classId: '501', name: '虚构旧生' }] });
  try {
    await new Promise((resolve) => service.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${service.server.address().port}`;
    const tokens = {};
    const send = async (route, body) => {
      const response = await fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json', ...(tokens[body.studentId] ? { Authorization: `Bearer ${tokens[body.studentId]}` } : {}) }, body: JSON.stringify(body) });
      assert.equal(response.status, 200);
      const result = await response.json();
      if (result.sessionToken) tokens[result.student.studentId] = result.sessionToken;
      return result;
    };
    await send('/api/login', { classId: '501', studentId: 'old-fake' });
    const old = service.db.prepare('SELECT json FROM states WHERE studentId=?').get('old-fake');
    const oldState = JSON.parse(old.json);
    delete oldState.evidenceHistory;
    oldState.stations.s1_order = true;
    oldState.stations.s2_rewrite = true;
    service.db.prepare('UPDATE states SET json=? WHERE studentId=?').run(JSON.stringify(oldState), 'old-fake');
    const { state } = await send('/api/evidence', { studentId: 'old-fake', evidence: { eventId: 'old-new', taskId: 's2_rewrite', eventType: 'evidence_lock', correct: true, payload: {} } });
    assert.equal(state.priorEvidenceUnknown, true);
    assert.equal(state.evidenceHistory[0].attemptKind, 'unknown');
    assert.equal(state.stations.s1_order, true);
  } finally {
    await service.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('case runs do not consume the first attempt; invalidation preserves history and an already open exam', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lotus-invalidation-'));
  const service = createService({ dataDir, roster: [
    { id: 'student-a', classId: '501', name: '虚构甲' },
    { id: 'student-b', classId: '502', name: '虚构乙' },
  ] });
  try {
    await new Promise((resolve) => service.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${service.server.address().port}`;
    const tokens = {};
    const send = async (route, body) => {
      const response = await fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json', ...(tokens[body.studentId] ? { Authorization: `Bearer ${tokens[body.studentId]}` } : {}) }, body: JSON.stringify(body) });
      const result = await response.json();
      if (result.sessionToken) tokens[result.student.studentId] = result.sessionToken;
      assert.equal(response.status, 200, JSON.stringify(result));
      return result.state;
    };
    await send('/api/login', { classId: '501', studentId: 'student-a' });
    await send('/api/login', { classId: '502', studentId: 'student-b' });
    let sequence = 0;
    const record = (eventType, taskId, extra = {}) => send('/api/evidence', {
      studentId: 'student-a', evidence: { eventId: `event-${++sequence}`, eventType, taskId, ...extra },
    });
    await record('case_run', 's2_rewrite', { correct: false, payload: { caseId: 'green_at_start' } });
    await record('case_run', 's2_rewrite', { correct: false, payload: { caseId: 'red_then_green' } });
    let state = await record('attempt', 's2_rewrite', { correct: false });
    assert.deepEqual(state.evidenceHistory.map((item) => item.attemptKind), ['process', 'process', 'first']);
    state = await record('evidence_lock', 's2_rewrite', { correct: true });
    assert.equal(state.evidenceHistory.at(-1).attemptKind, 'revision');
    state = await record('current_invalidated', 's2_rewrite', { payload: { reason: 'edit' } });
    assert.equal(state.stations.s1_order, false);
    assert.equal(state.stations.s2_rewrite, false);
    assert.equal(state.examOpen, false);
    assert.equal(state.evidenceHistory.length, 5);
    await record('evidence_lock', 's2_rewrite', { correct: true });
    await record('evidence_lock', 's2_vs_branch', { correct: true });
    await record('evidence_lock', 's2_kettle', { correct: true });
    state = await record('evidence_lock', 's3_timing', {
      correct: true, s3Detail: { faultObserved: true, strategy: 'st_car_long', ruleChanged: true, revalidateOk: true },
    });
    assert.equal(state.examOpen, true);
    state = await record('current_invalidated', 's3_timing');
    assert.equal(state.stations.s3_timing, false);
    assert.equal(state.s3Detail.revalidateOk, false);
    assert.equal(state.s3Detail.faultObserved, true);
    assert.equal(state.examOpen, true);
    const historyLength = state.evidenceHistory.length;
    state = await record('station_reset', 's3_timing');
    assert.equal(state.s3Detail.faultObserved, false);
    assert.equal(state.s3Detail.strategy, '');
    assert.equal(state.evidenceHistory.length, historyLength + 1);
    assert.equal(state.evidenceHistory.at(-1).attemptKind, 'process');
    assert.equal(state.examOpen, true);
    const other = await (await fetch(base + '/api/state?studentId=student-b', { headers: { Authorization: `Bearer ${tokens['student-b']}` } })).json();
    assert.equal(other.state.evidenceHistory.length, 0);
    assert.equal(other.state.examOpen, false);
    state = await send('/api/exam/submit', { studentId: 'student-a', eventId: 'exam-after-edit', answers: {} });
    assert.equal(state.examOpen, true);
    assert.equal(state.stations.exam, true);
  } finally {
    await service.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
