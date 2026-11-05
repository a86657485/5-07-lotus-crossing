extends Node
## JavaScriptBridge ↔ window.G5L7Classroom（设计 §6.2）

signal session_received(data: Dictionary)
signal station_unlock(task_id: String, unlocked: bool)
signal exam_open_from_web
signal exam_closed_from_web
signal story_replay_request(payload: Dictionary)
signal flow_result(payload: Dictionary)
signal relic_synced(remaining: int)

var _js_cb_refs: Array = []  # keep JS callbacks alive
var _ready_posted: bool = false

func _ready() -> void:
	call_deferred("_boot")

func _boot() -> void:
	if OS.has_feature("web"):
		_install_js_bridge()
	else:
		# Desktop / headless mock session for local smoke
		call_deferred("_emit_mock_session")
	_post_ready()

func _emit_mock_session() -> void:
	var mock := {
		"studentId": "501|演示学生|0",
		"classId": "501",
		"displayName": "演示学生",
		"runId": "local-mock",
		"isTest": true,
		"relicRemaining": 3,
		"stations": GameState.stations.duplicate(),
	}
	_on_app_session(mock)

func _install_js_bridge() -> void:
	if not JavaScriptBridge.has_method("eval"):
		return
	# Ensure host object exists
	JavaScriptBridge.eval("""
(function(){
  if (!window.G5L7Classroom) {
    window.G5L7Classroom = {
      _handlers: {},
      on: function(ev, fn){ (this._handlers[ev]=this._handlers[ev]||[]).push(fn); },
      emit: function(ev, data){ (this._handlers[ev]||[]).forEach(function(f){ try{f(data);}catch(e){console.error(e);} }); },
      getStudent: function(){ return this._student || null; },
      getProgress: function(){ return this._progress || null; },
      reportStation: function(taskId, payload){ this.emit('evidence:report', Object.assign({taskId:taskId}, payload||{})); },
      useRelic: function(){ this.emit('relic:use', {}); },
      onExamOpen: function(cb){ this.on('exam:open', cb); }
    };
  }
  window.G5L7Classroom._godotReady = true;
})();
""", true)
	var cb_session := JavaScriptBridge.create_callback(_js_session)
	var cb_unlock := JavaScriptBridge.create_callback(_js_unlock)
	var cb_exam_open := JavaScriptBridge.create_callback(_js_exam_open)
	var cb_exam_closed := JavaScriptBridge.create_callback(_js_exam_closed)
	var cb_replay := JavaScriptBridge.create_callback(_js_replay)
	var cb_flow := JavaScriptBridge.create_callback(_js_flow)
	var cb_relic := JavaScriptBridge.create_callback(_js_relic_sync)
	var cb_reset := JavaScriptBridge.create_callback(_js_reset)
	var cb_focus := JavaScriptBridge.create_callback(_js_focus)
	_js_cb_refs = [cb_session, cb_unlock, cb_exam_open, cb_exam_closed, cb_replay, cb_flow, cb_relic, cb_reset, cb_focus]
	JavaScriptBridge.eval("window._g5l7Bind = function(name, cb){ window.G5L7Classroom.on(name, function(d){ cb(JSON.stringify(d == null ? {} : d)); }); };", true)
	var js_window = JavaScriptBridge.get_interface("window")
	if js_window:
		js_window._g5l7Bind("app:session", cb_session)
		js_window._g5l7Bind("station:unlock", cb_unlock)
		js_window._g5l7Bind("exam:open", cb_exam_open)
		js_window._g5l7Bind("exam:closed", cb_exam_closed)
		js_window._g5l7Bind("story:replay", cb_replay)
		js_window._g5l7Bind("flow:result", cb_flow)
		js_window._g5l7Bind("relic:sync", cb_relic)
		js_window._g5l7Bind("station:reset", cb_reset)
		js_window._g5l7Bind("station:focus", cb_focus)
	# Also poll getStudent once
	JavaScriptBridge.eval("""
(function(){
	  var b = window.G5L7Classroom;
	  var s = b && b.getStudent && b.getStudent();
	  if (s) {
	    if (b.setSession) { b.setSession(s, b.getProgress && b.getProgress()); }
	    else { b.emit('app:session', s); }
	  }
})();
""", true)

func _js_session(args: Array) -> void:
	var data = _to_dict(args)
	_on_app_session(data)

func _js_unlock(args: Array) -> void:
	var data = _to_dict(args)
	station_unlock.emit(str(data.get("taskId", "")), bool(data.get("unlocked", true)))

func _js_exam_open(_args: Array) -> void:
	exam_open_from_web.emit()

func _js_exam_closed(_args: Array) -> void:
	exam_closed_from_web.emit()

func _js_replay(args: Array) -> void:
	story_replay_request.emit(_to_dict(args))

func _js_flow(args: Array) -> void:
	flow_result.emit(_to_dict(args))

func _js_relic_sync(args: Array) -> void:
	var data = _to_dict(args)
	var rem := int(data.get("remaining", GameState.relic_remaining))
	GameState.relic_remaining = rem
	GameState.relic_used = maxi(0, GameState.relic_quota - rem)
	GameState.relic_changed.emit()
	relic_synced.emit(rem)

func _js_reset(args: Array) -> void:
	var data = _to_dict(args)
	var tid := str(data.get("taskId", ""))
	if tid != "":
		GameState.reset_station(tid)

func _js_focus(args: Array) -> void:
	var data = _to_dict(args)
	GameState.set_focus(str(data.get("targetId", "")))

func _on_app_session(data: Dictionary) -> void:
	GameState.apply_session(data)
	if data.has("stations") and data["stations"] is Dictionary:
		GameState.sync_stations(data["stations"])
	if data.get("s3Detail") is Dictionary:
		GameState.s3_detail = data["s3Detail"].duplicate(true)
	var relics = data.get("relics", {})
	if relics is Dictionary and relics.get("unlockedRelics") is Dictionary:
		GameState.unlocked_relics = relics["unlockedRelics"].duplicate()
	session_received.emit(data)

func _to_dict(args: Array) -> Dictionary:
	if args.is_empty():
		return {}
	var v = args[0]
	if v is Dictionary:
		return v
	if v is String:
		var parsed = JSON.parse_string(v)
		if parsed is Dictionary:
			return parsed
	return {}

func _post_ready() -> void:
	if _ready_posted:
		return
	_ready_posted = true
	emit_to_js("godot:ready", {"version": "g5l7-rpg-mvp"})

func emit_to_js(event_name: String, payload: Dictionary = {}) -> void:
	if OS.has_feature("web"):
		var json := JSON.stringify(payload)
		var safe_ev := event_name.replace("'", "")
		JavaScriptBridge.eval("window.G5L7Classroom && window.G5L7Classroom.emit('%s', %s);" % [safe_ev, json], true)
	else:
		print("[Bridge→JS mock] ", event_name, " ", payload)

func report_evidence(envelope: Dictionary) -> void:
	emit_to_js("evidence:report", envelope)

func report_station(task_id: String, payload: Dictionary) -> void:
	var body := payload.duplicate()
	body["taskId"] = task_id
	emit_to_js("evidence:report", body)
	# legacy helper
	emit_to_js("station:complete", body)

func use_relic() -> void:
	emit_to_js("relic:use", {})

func request_scaffold(task_id: String, level: int, misconception_id: String = "") -> void:
	emit_to_js("scaffold:offer", {"taskId": task_id, "level": level, "misconceptionId": misconception_id})

func open_exam() -> void:
	emit_to_js("exam:open", {})

func gate_state(task_id: String, gate_state: String) -> void:
	emit_to_js("gate:state", {"taskId": task_id, "gateState": gate_state})
	GameState.set_gate(task_id, gate_state)

func story_replay(from_frame: int = 1, closable: bool = true) -> void:
	emit_to_js("story:replay", {"fromFrame": from_frame, "closable": closable})

func flow_open(panel_id: String, meta: Dictionary = {}) -> void:
	var p := meta.duplicate()
	p["panelId"] = panel_id
	emit_to_js("flow:open", p)

func flow_close(panel_id: String) -> void:
	emit_to_js("flow:close", {"panelId": panel_id})
