const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadBridge(file = path.join(__dirname, 'classroom_bridge.js')) {
  const sent = [];
  const parent = { postMessage: (data, origin) => sent.push({ data, origin }) };
  const listeners = {};
  const window = {
    parent, location: { origin: 'http://classroom.test' },
    addEventListener: (type, callback) => { listeners[type] = callback; },
  };
  const context = vm.createContext({ window, console, JSON });
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
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

// This runs the real JS binder, but the callback is a VM test double, NOT a real Godot runtime.
function bindFlow(bridge, callback) {
  const gd = fs.readFileSync(path.join(__dirname, '../project/scripts/bridge/classroom_bridge.gd'), 'utf8');
  const binder = gd.match(/JavaScriptBridge\.eval\("(window\._g5l7Bind[^\n]+)", true\)/);
  assert.ok(binder);
  vm.runInContext(binder[1], bridge.context);
  bridge.context.window._g5l7Bind('flow:result', callback);
}
function receive(bridge, event, payload = {}) {
  bridge.listeners.message({ source: bridge.parent, origin: 'http://classroom.test',
    data: { source: 'g5l7-host', event, payload } });
}
for (const relative of ['classroom_bridge.js', '../../public/godot/classroom_bridge.js', '../export/web/classroom_bridge.js']) {
  test(`${relative}: synchronous flow callback queues completion/unlock/detail until host dispatch finishes`, () => {
    const bridge = loadBridge(path.join(__dirname, relative));
    let synchronous = false;
    bindFlow(bridge, (json) => {
      synchronous = true;
      assert.equal(JSON.parse(json).panelId, 's1');
      bridge.api.emit('flow:close', { panelId: 's1' });
      bridge.api.reportStation('s2_rewrite', { eventType: 'evidence_lock', correct: true });
      bridge.api.emit('station:unlock', { taskId: 's2_vs_branch', unlocked: true });
      bridge.api.emit('progress:s3Detail', { revalidateOk: true });
      assert.equal(bridge.sent.length, 0, 'outbound messages wait until synchronous host callback returns');
    });
    receive(bridge, 'flow:result', { panelId: 's1', correct: true });
    assert.equal(synchronous, true);
    assert.deepEqual(bridge.sent.map(x => x.data.event), ['flow:close', 'evidence:report', 'station:unlock', 'progress:s3Detail']);
    assert.equal(bridge.sent[1].data.payload.taskId, 's2_rewrite');
    assert.ok(bridge.sent.every(x => x.origin === 'http://classroom.test'));
    bridge.api.emit('godot:ready', {});
    assert.equal(bridge.sent.at(-1).data.event, 'godot:ready');
  });
}
test('nested host dispatch preserves FIFO, restores outer echo guard, and flushes once', () => {
  const b = loadBridge();
  b.api.on('flow:result', () => {
    b.api.emit('evidence:report', { order: 1 });
    receive(b, 'relic:sync', { remaining: 2 });
    b.api.emit('station:unlock', { order: 3 });
    assert.equal(b.sent.length, 0);
  });
  b.api.on('relic:sync', () => b.api.emit('progress:s3Detail', { order: 2 }));
  receive(b, 'flow:result', {});
  assert.deepEqual(b.sent.map(x => x.data.payload.order), [1, 2, 3]);
  assert.ok(!b.sent.some(x => ['flow:result', 'relic:sync'].includes(x.data.event)));
  receive(b, 'empty:event');
  assert.equal(b.sent.length, 3, 'queue does not replay on next dispatch');
});
test('a throwing callback cannot strand the queue or disable later outbound events', () => {
  const b = loadBridge();
  b.context.console = { ...console, error() {} };
  b.api.on('flow:result', () => {
    b.api.emit('evidence:report', { order: 1 });
    throw new Error('deliberate callback failure');
  });
  b.api.on('flow:result', () => b.api.emit('station:unlock', { order: 2 }));
  receive(b, 'flow:result');
  b.api.emit('godot:ready', { order: 3 });
  assert.deepEqual(b.sent.map(x => x.data.payload.order), [1, 2, 3]);
});
test('host app:session suppresses same-name echo but retains callback-generated evidence', () => {
  const b = loadBridge();
  b.api.on('app:session', () => b.api.reportStation('intro', { eventType: 'evidence_lock', correct: true }));
  receive(b, 'app:session', { student: { studentId: 'fixture' }, stations: {} });
  assert.deepEqual(b.sent.map(x => x.data.event), ['evidence:report']);
});
test('all shipped/export/source bridge copies stay byte-identical', () => {
  const canonical = fs.readFileSync(path.join(__dirname, 'classroom_bridge.js'), 'utf8');
  for (const relative of ['../../public/godot/classroom_bridge.js', '../export/web/classroom_bridge.js']) {
    assert.equal(fs.readFileSync(path.join(__dirname, relative), 'utf8'), canonical);
  }
});
