/**
 * G5L7Classroom — Godot HTML5 ↔ 课堂 /api 桥
 * 挂到 window.G5L7Classroom，供 Godot JavaScriptBridge 调用。
 * 不改题库/达标线/法宝配额(3)；仅转发 progress / relic。
 */
(function (global) {
  'use strict';

  var STORAGE_STUDENT = 'g5l7.classroom.student';
  var STORAGE_PROGRESS = 'g5l7.classroom.progress';
  var API_BASE = '';

  function readJson(key) {
    try {
      var raw = global.localStorage && global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      /* ignore quota / private mode */
    }
  }

  function studentIdFromQuery() {
    try {
      var q = new URLSearchParams(global.location.search || '');
      return q.get('studentId') || '';
    } catch (e) {
      return '';
    }
  }

  function getCachedStudent() {
    var s = readJson(STORAGE_STUDENT);
    if (s && s.studentId) return s;
    var sid = studentIdFromQuery();
    if (sid) {
      return { studentId: sid, classId: '', name: '' };
    }
    return null;
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

  function emptyRelics() {
    return {
      quota: 3,
      used: 0,
      remaining: 3,
      unlockedRelics: { whistle: false, arrow: false, knob: false },
    };
  }

  function normalizeProgress(state) {
    if (!state) {
      return { stations: emptyStations(), relics: emptyRelics(), examOpen: false };
    }
    return {
      stations: Object.assign(emptyStations(), state.stations || {}),
      relics: Object.assign(emptyRelics(), state.relics || {}),
      examOpen: !!state.examOpen,
      s3Detail: state.s3Detail || null,
    };
  }

  function getCachedProgress() {
    return normalizeProgress(readJson(STORAGE_PROGRESS));
  }

  function request(path, init) {
    return fetch(API_BASE + path, Object.assign({
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    }, init || {})).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || ('请求失败 (' + res.status + ')'));
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function stationPatchForTask(taskId) {
    var id = String(taskId || '');
    if (id === 's1' || id === 'S1' || id === 's1_order') {
      return {
        stations: { s1_order: true },
        relics: { unlockedRelics: { whistle: true } },
      };
    }
    if (id === 's2' || id === 'S2' || id === 's2_rewrite' || id === 's2_vs_branch' || id === 's2_kettle') {
      return {
        stations: { s2_rewrite: true, s2_vs_branch: true, s2_kettle: true },
        relics: { unlockedRelics: { arrow: true } },
      };
    }
    if (id === 's3' || id === 'S3' || id === 's3_timing') {
      return {
        stations: { s3_timing: true },
        relics: { unlockedRelics: { knob: true } },
      };
    }
    return { stations: {}, relics: {} };
  }

  function mergeRelicUnlock(current, patchUnlock) {
    var base = (current && current.unlockedRelics) || {};
    var next = Object.assign({ whistle: false, arrow: false, knob: false }, base);
    if (patchUnlock) {
      if (patchUnlock.whistle) next.whistle = true;
      if (patchUnlock.arrow) next.arrow = true;
      if (patchUnlock.knob) next.knob = true;
    }
    return {
      quota: (current && current.quota) || 3,
      used: (current && current.used) || 0,
      remaining: (current && typeof current.remaining === 'number') ? current.remaining : 3,
      unlockedRelics: next,
    };
  }

  var examOpenCallbacks = [];

  var api = {
    /** 由课堂壳在登录后调用，写入本地上下文供 iframe/Godot 读取 */
    setContext: function (student, progress) {
      if (student) writeJson(STORAGE_STUDENT, student);
      if (progress) writeJson(STORAGE_PROGRESS, normalizeProgress(progress));
    },

    getStudent: function () {
      return getCachedStudent();
    },

    getProgress: function () {
      return getCachedProgress();
    },

    /** 拉取服务端最新进度并刷新缓存；返回 Promise */
    refreshProgress: function () {
      var student = getCachedStudent();
      if (!student || !student.studentId) {
        return Promise.reject(new Error('未登录：缺少 studentId'));
      }
      return request('/api/state?studentId=' + encodeURIComponent(student.studentId)).then(function (data) {
        if (data.student) writeJson(STORAGE_STUDENT, data.student);
        var prog = normalizeProgress(data.state);
        writeJson(STORAGE_PROGRESS, prog);
        return prog;
      });
    },

    /**
     * 上报探究站完成证据。
     * @param {string} taskId  s1|s2|s3 或 s1_order 等
     * @param {object} [payload] 可选附加 stations/s3Detail
     * @returns {Promise}
     */
    reportStation: function (taskId, payload) {
      var student = getCachedStudent();
      if (!student || !student.studentId) {
        return Promise.reject(new Error('未登录：缺少 studentId'));
      }
      var mapped = stationPatchForTask(taskId);
      var body = { studentId: student.studentId };
      var stations = Object.assign({}, mapped.stations);
      if (payload && payload.stations) Object.assign(stations, payload.stations);
      body.stations = stations;

      var cur = getCachedProgress();
      if (mapped.relics && mapped.relics.unlockedRelics) {
        body.relics = mergeRelicUnlock(cur.relics, mapped.relics.unlockedRelics);
      }
      if (payload && payload.s3Detail) body.s3Detail = payload.s3Detail;
      if (payload && payload.relics) {
        body.relics = mergeRelicUnlock(body.relics || cur.relics, payload.relics.unlockedRelics);
      }

      return request('/api/progress', {
        method: 'POST',
        body: JSON.stringify(body),
      }).then(function (data) {
        if (data.student) writeJson(STORAGE_STUDENT, data.student);
        var prog = normalizeProgress(data.state);
        writeJson(STORAGE_PROGRESS, prog);
        if (prog.examOpen) {
          examOpenCallbacks.forEach(function (cb) {
            try { cb(prog); } catch (e) { /* ignore */ }
          });
        }
        return prog;
      });
    },

    /** 消耗一次通关法宝（配额由服务端锁定为 3） */
    useRelic: function () {
      var student = getCachedStudent();
      if (!student || !student.studentId) {
        return Promise.reject(new Error('未登录：缺少 studentId'));
      }
      return request('/api/relic', {
        method: 'POST',
        body: JSON.stringify({ studentId: student.studentId }),
      }).then(function (data) {
        if (data.student) writeJson(STORAGE_STUDENT, data.student);
        var prog = normalizeProgress(data.state);
        writeJson(STORAGE_PROGRESS, prog);
        return {
          progress: prog,
          hint: '原理解析占位：循环用「重复做同一组步骤」代替逐条抄写；法宝只提示思路，不代做。',
          relics: prog.relics,
        };
      });
    },

    onExamOpen: function (cb) {
      if (typeof cb === 'function') examOpenCallbacks.push(cb);
    },
  };

  global.G5L7Classroom = api;
})(typeof window !== 'undefined' ? window : globalThis);
