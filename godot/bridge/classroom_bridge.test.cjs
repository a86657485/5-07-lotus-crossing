const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadBridge() {
  const sent = [];
  const parent = { postMessage: (data, origin) => sent.push({ data, origin }) };
  const listeners = {};
  const window = {
    parent, location: { origin: 'http://classroom.test' },
    addEventListener: (type, callback) => { listeners[type] = callback; },
  };
  const context = vm.createContext({ window, console, JSON });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'classroom_bridge.js'), 'utf8'), context);
  return { api: window.G5L7Classroom, context, sent, parent, listeners };
}

test('Godot callback receives session and quota as a JSON string', () => {
  const bridge = loadBridge();
  const gd = fs.readFileSync(path.join(__dirname, '../project/scripts/bridge/classroom_bridge.gd'), 'utf8');
  const binder = gd.match(/JavaScriptBridge\.eval\("(window\._g5l7Bind[^\n]+)", true\)/);
  assert.ok(binder, 'the actual callback binder is exercised');
  vm.runInContext(binder[1], bridge.context);
  let value;
  const registration = gd.match(/(?:bind\.call|js_window\._g5l7Bind)\("app:session", cb_session\)/);
  assert.ok(registration, 'the actual Godot registration call is exercised');
  bridge.context.bind = bridge.context.window._g5l7Bind;
  bridge.context.js_window = bridge.context.window;
  bridge.context.cb_session = (payload) => { value = payload; };
  vm.runInContext(registration[0], bridge.context);
  bridge.api.setSession({ studentId: 'test-501', name: '桥接测试', classId: '501' }, {
    stations: { s1_order: true }, relics: { remaining: 0 },
    s3Detail: { faultObserved: true, revalidateOk: false },
  });
  assert.equal(typeof value, 'string');
  const payload = JSON.parse(value);
  assert.equal(payload.studentId, 'test-501');
  assert.equal(payload.stations.s1_order, true);
  assert.equal(payload.relicRemaining, 0);
  assert.equal(payload.s3Detail.faultObserved, true);
});

test('iframe accepts the same-origin parent once and does not echo host events', () => {
  const bridge = loadBridge();
  const sessions = [];
  bridge.api.on('app:session', (payload) => sessions.push(payload));
  const data = { source: 'g5l7-host', event: 'app:session', payload: {
    student: { studentId: 'test-502', classId: '502', name: '恢复测试' },
    stations: { s2_rewrite: true }, relics: { remaining: 1 },
    s3Detail: { faultObserved: true }, runId: 'test-run',
  } };
  assert.equal(typeof bridge.listeners.message, 'function');
  bridge.listeners.message({ source: {}, origin: 'http://classroom.test', data });
  bridge.listeners.message({ source: bridge.parent, origin: 'http://elsewhere.test', data });
  assert.equal(sessions.length, 0);
  bridge.listeners.message({ source: bridge.parent, origin: 'http://classroom.test', data });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].studentId, 'test-502');
  assert.equal(sessions[0].relicRemaining, 1);
  assert.equal(sessions[0].s3Detail.faultObserved, true);
  assert.equal(bridge.sent.length, 0, 'host messages are not relayed back');
  bridge.api.emit('relic:use', {});
  assert.equal(bridge.sent.length, 1);
  assert.equal(bridge.sent[0].data.event, 'relic:use');
  assert.equal(bridge.sent[0].origin, 'http://classroom.test');
});
