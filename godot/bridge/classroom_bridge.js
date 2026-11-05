/**
 * G5L7Classroom bridge — Web 壳注入，Godot JavaScriptBridge 对端
 */
(function (global) {
  const handlers = {};
  let receivingHostMessage = false;
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
      if (!receivingHostMessage && global.parent && global.parent !== global) {
        global.parent.postMessage({ source: 'g5l7-godot', event: ev, payload: data }, global.location.origin);
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
    receivingHostMessage = true;
    try {
      if (event === 'app:session') {
        api.setSession(payload?.student || payload, payload);
      } else {
        api.emit(event, payload);
      }
    } finally {
      receivingHostMessage = false;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
