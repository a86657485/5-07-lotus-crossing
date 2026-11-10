'use strict';
/** Real JS bridge + real isolated HTTP/SQLite service; callback is a VM double, NOT Godot/WASM. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createService } = require('../../server.cjs');

for (const route of ['web-envelope', 'bridge-vm']) {
  test(`${route}: completion survives GET refresh, next station, service restart and re-login; revisit invalidation reproduced`, async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g5l7-bridge-regression-'));
    const roster = [{ id: 'bridge-fixture', classId: '501', name: '隔离桥接回归' }];
    let service, base, token, sequence = 0;
    const observations = [];
    const start = async () => {
      service = createService({ dataDir, roster });
      await new Promise(resolve => service.server.listen(0, '127.0.0.1', resolve));
      base = `http://127.0.0.1:${service.server.address().port}`;
    };
    const request = async (endpoint, body) => {
      const res = await fetch(base + endpoint, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json();
      assert.equal(res.status, 200, JSON.stringify(data));
      return data;
    };
    const login = async () => {
      const data = await request('/api/login', { classId: '501', studentId: 'bridge-fixture' });
      token = data.sessionToken;
      return data.state;
    };
    const getState = async () => (await request('/api/state?studentId=bridge-fixture')).state;
    const record = async evidence => (await request('/api/evidence', { studentId: 'bridge-fixture', evidence })).state;
    // This FIFO adapter represents the host onEvidence boundary, not the React event handler.
    let writes = Promise.resolve();
    const sent = [];
    const parent = { postMessage(data, origin) {
      sent.push(data);
      assert.equal(origin, 'http://classroom.test');
      if (data.event === 'evidence:report') writes = writes.then(() => record(data.payload));
    } };
    const listeners = {};
    const window = { parent, location: { origin: 'http://classroom.test' }, addEventListener(type, cb) { listeners[type] = cb; } };
    const context = vm.createContext({ window, console, JSON });
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'classroom_bridge.js'), 'utf8'), context);
    const api = window.G5L7Classroom;
    const receive = (event, payload) => listeners.message({ source: parent, origin: 'http://classroom.test', data: { source: 'g5l7-host', event, payload } });
    const gd = fs.readFileSync(path.join(__dirname, '../project/scripts/bridge/classroom_bridge.gd'), 'utf8');
    const binder = gd.match(/JavaScriptBridge\.eval\("(window\._g5l7Bind[^\n]+)", true\)/);
    assert.ok(binder);
    vm.runInContext(binder[1], context);
    window._g5l7Bind('flow:result', json => {
      const data = JSON.parse(json);
      api.emit('flow:close', { panelId: data.panelId });
      api.reportStation(data.evidence.taskId, data.evidence);
      if (data.panelId === 's1' || data.panelId === 's2c') api.emit('station:unlock', {
        taskId: data.panelId === 's1' ? 's2_vs_branch' : 's3_timing', unlocked: true,
      });
      if (data.panelId === 's3') api.emit('progress:s3Detail', data.evidence.s3Detail);
    });
    const snapshot = async label => {
      const state = await getState();
      observations.push({ label, stations: state.stations, examOpen: state.examOpen, evidenceCount: state.evidenceHistory.length, stateVersion: state.stateVersion });
      return state;
    };
    const finish = async (panelId, taskId, code, payload = {}, s3Detail) => {
      const evidence = { eventId: `${route}-${++sequence}`, taskId, eventType: 'evidence_lock', correct: true, evidenceCode: code, payload, ...(s3Detail ? { s3Detail } : {}) };
      if (route === 'bridge-vm') {
        receive('flow:result', { panelId, evidence });
        await writes;
      } else await record(evidence);
      const state = await snapshot(`complete-${panelId}`);
      assert.equal(state.stations[taskId], true);
      // duplicate network delivery must not create duplicate evidence
      const retried = await record(evidence);
      assert.equal(retried.evidenceHistory.length, state.evidenceHistory.length);
      assert.equal(retried.stateVersion, state.stateVersion);
      return state;
    };
    try {
      await start();
      await login();
      const five = ['cond_bridge', 'cond_count', 'act_as_diamond', 'cond_arrive', 'cond_green_off'];
      await finish('s1', 's2_rewrite', 'E1', { testedConditions: five, conditionCardId: 'cond_green_off', backEdgeTo: 'observe', noEdgeTo: 'cross' });
      const refreshed = await snapshot('refresh-after-s1');
      assert.equal(refreshed.stations.s1_order, true);
      assert.deepEqual(refreshed.evidenceHistory.at(-1).payload.testedConditions, five);
      receive('app:session', { student: { studentId: 'bridge-fixture' }, stations: refreshed.stations });
      assert.equal(api.getProgress().stations.s2_rewrite, true);
      await finish('s2b', 's2_vs_branch', 'E2');
      const beforeRestart = await snapshot('switch-station-s2c');
      await service.close();
      service = null;
      await start();
      const afterRestart = await snapshot('sqlite-reopen');
      assert.deepEqual(afterRestart.stations, beforeRestart.stations);
      const rejoined = await login();
      assert.deepEqual(rejoined.stations, beforeRestart.stations);
      await snapshot('re-login-same-student');
      await finish('s2c', 's2_kettle', 'E3', { testedTemperatures: [80, 100] });
      const final = await finish('s3', 's3_timing', 'E4', {}, { faultObserved: true, scenario: 'car_heavy', strategy: 'st_car_long', reason: 'rs_evacuate', ruleChanged: true, revalidateOk: true });
      assert.equal(final.examOpen, true);
      assert.equal(final.relics.unlockedRelics.whistle, true);
      assert.equal(final.relics.unlockedRelics.arrow, true);
      assert.equal(final.relics.unlockedRelics.knob, true);
      assert.equal(final.s3Detail.revalidateOk, true);
      if (route === 'bridge-vm') {
        assert.deepEqual(sent.map(x => x.event), ['flow:close', 'evidence:report', 'station:unlock', 'flow:close', 'evidence:report', 'flow:close', 'evidence:report', 'station:unlock', 'flow:close', 'evidence:report', 'progress:s3Detail']);
      }
      const invalidated = await record({ eventId: `${route}-revisit`, taskId: 's2_rewrite', eventType: 'current_invalidated', payload: { reason: 'edit' } });
      assert.equal(invalidated.stations.s1_order, false);
      assert.equal(invalidated.stations.s2_rewrite, false);
      await snapshot('KNOWN-ISSUE-revisit-edit-clears-S1');
      const afterLogin = await login();
      assert.equal(afterLogin.stations.s2_rewrite, false);
      // Characterization only: report the existing bug; do not change server semantics here.
      console.log(JSON.stringify({ route, runtime: 'VM callback / HTTP service, NOT browser or actual Godot', observations }));
    } finally {
      await service?.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
}
