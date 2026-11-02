/**
 * G5L7Classroom bridge — Web 壳注入，Godot JavaScriptBridge 对端
 */
(function (global) {
  const handlers = {};
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
        displayName: student?.name,
        runId: progress?.runId || student?.studentId,
        isTest: !!student?.isTest,
        relicRemaining: progress?.relics?.remaining ?? 3,
        stations: progress?.stations || {},
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
})(typeof window !== 'undefined' ? window : globalThis);
