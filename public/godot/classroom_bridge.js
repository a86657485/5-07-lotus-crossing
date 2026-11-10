/**
 * G5L7Classroom bridge — Web 壳注入，Godot JavaScriptBridge 对端
 */
(function (global) {
  const handlers = {};
  // Godot 的回调是同步执行的：宿主下发 flow:result / app:session 时，GDScript 仍在同一个
  // JS 调用栈里就会 emit 完成证据与解锁事件。早先用布尔 isReceivingHostMessage 一律拦截，
  // 会把这些事件一并吞掉（表现为：引导台做完了，但服务端没记录，刷新后第二站进不去）。
  // 这里只拦「同名回声」，其余事件照常上报宿主。
  let hostEventName = null;
  let hostDepth = 0;
  const pendingOut = [];
  const postToHost = (ev, data) => {
    if (global.parent && global.parent !== global) {
      global.parent.postMessage({ source: 'g5l7-godot', event: ev, payload: data }, global.location.origin);
    }
  };
  const api = {
    _student: null,
    _progress: null,
    _godotReady: false,
    on(ev, fn) {
      (handlers[ev] = handlers[ev] || []).push(fn);
    },
    off(ev, fn) {
      handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn);
    },
    emit(ev, data) {
      // 同名回声（宿主刚下发的事件被 Godot 侧原样回抛）不回传，避免自激。
      if (ev !== hostEventName) {
        if (hostDepth > 0) pendingOut.push([ev, data]);
        else postToHost(ev, data);
      }
      (handlers[ev] || []).forEach((f) => {
        try {
          f(data);
        } catch (e) {
          console.error('[G5L7Classroom]', ev, e);
        }
      });
    },
    getStudent() {
      return this._student;
    },
    getProgress() {
      return this._progress;
    },
    setSession(student, progress) {
      this._student = student;
      this._progress = progress;
      this.emit('app:session', {
        studentId: student?.studentId,
        classId: student?.classId,
        displayName: student?.name ?? student?.displayName,
        runId: progress?.runId || student?.studentId,
        isTest: !!student?.isTest,
        relicRemaining: progress?.relics?.remaining ?? progress?.relicRemaining ?? 3,
        stations: progress?.stations || {},
        student,
        relics: progress?.relics || {},
        s3Detail: progress?.s3Detail || {},
        webPanels: !!progress?.webPanels,
        introSeen: !!progress?.introSeen,
        examOpen: !!progress?.examOpen,
      });
    },
    reportStation(taskId, payload) {
      this.emit('evidence:report', Object.assign({ taskId }, payload || {}));
    },
    useRelic() {
      this.emit('relic:use', {});
    },
    onExamOpen(cb) {
      this.on('exam:open', cb);
    },
  };
  global.G5L7Classroom = api;
  global.addEventListener('message', (message) => {
    if (message.source !== global.parent || message.origin !== global.location.origin) return;
    if (!message.data || message.data.source !== 'g5l7-host') return;
    const { event, payload } = message.data;
    const previous = hostEventName;
    hostDepth += 1;
    hostEventName = event;
    try {
      if (event === 'app:session') {
        api.setSession(payload?.student || payload, payload);
      } else {
        api.emit(event, payload);
      }
    } finally {
      hostEventName = previous;
      hostDepth -= 1;
      if (hostDepth === 0 && pendingOut.length) {
        const queue = pendingOut.splice(0, pendingOut.length);
        queue.forEach(([ev, data]) => postToHost(ev, data));
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
