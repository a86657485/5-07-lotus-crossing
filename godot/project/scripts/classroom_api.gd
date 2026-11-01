extends Node
## 封装 window.G5L7Classroom（Web）与本地降级。

signal progress_updated(progress: Dictionary)
signal station_reported(task_id: String, ok: bool, message: String)
signal relic_used(ok: bool, hint: String, remaining: int)

var _bridge: Variant = null
var _has_bridge: bool = false
var _fallback_progress: Dictionary = {
	"stations": {
		"s1_order": false,
		"s2_rewrite": false,
		"s2_vs_branch": false,
		"s2_kettle": false,
		"s3_timing": false,
		"exam": false,
	},
	"relics": {
		"quota": 3,
		"used": 0,
		"remaining": 3,
		"unlockedRelics": {"whistle": false, "arrow": false, "knob": false},
	},
	"examOpen": false,
}
var _cb_report: JavaScriptObject
var _cb_relic: JavaScriptObject
var _cb_refresh: JavaScriptObject
var _pending_task: String = ""


func _ready() -> void:
	if OS.has_feature("web"):
		_bridge = JavaScriptBridge.get_interface("G5L7Classroom")
		_has_bridge = _bridge != null
		if _has_bridge:
			_cb_report = JavaScriptBridge.create_callback(_on_report_js)
			_cb_relic = JavaScriptBridge.create_callback(_on_relic_js)
			_cb_refresh = JavaScriptBridge.create_callback(_on_refresh_js)
			# 尝试刷新服务端进度
			_call_promise(_bridge.refreshProgress(), _cb_refresh)
		else:
			push_warning("G5L7Classroom 桥未注入，使用本地降级")
	else:
		_has_bridge = false


func has_bridge() -> bool:
	return _has_bridge


func get_student() -> Dictionary:
	if _has_bridge:
		var s: Variant = _bridge.getStudent()
		if s == null:
			return {}
		return _js_to_dict(s)
	return {"studentId": "local-demo", "classId": "501", "name": "本地演示"}


func get_progress() -> Dictionary:
	if _has_bridge:
		var p: Variant = _bridge.getProgress()
		if p == null:
			return _fallback_progress.duplicate(true)
		return _js_to_dict(p)
	return _fallback_progress.duplicate(true)


func report_station(task_id: String, payload: Dictionary = {}) -> void:
	_pending_task = task_id
	if _has_bridge:
		var js_payload: Variant = _dict_to_js(payload)
		_call_promise(_bridge.reportStation(task_id, js_payload), _cb_report)
		return
	# 本地降级：只改内存并提示
	_apply_local_station(task_id)
	station_reported.emit(task_id, true, "非 Web 导出，跳过上报")
	progress_updated.emit(get_progress())


func use_relic() -> void:
	if _has_bridge:
		_call_promise(_bridge.useRelic(), _cb_relic)
		return
	var relics: Dictionary = _fallback_progress["relics"]
	if int(relics.get("remaining", 0)) <= 0:
		relic_used.emit(false, "通关法宝次数已用完（本地）", 0)
		return
	relics["used"] = int(relics.get("used", 0)) + 1
	relics["remaining"] = max(0, 3 - int(relics["used"]))
	_fallback_progress["relics"] = relics
	relic_used.emit(
		true,
		"非 Web 导出，跳过上报 · 原理解析占位：循环=重复同一组步骤",
		int(relics["remaining"])
	)
	progress_updated.emit(get_progress())


func _apply_local_station(task_id: String) -> void:
	var st: Dictionary = _fallback_progress["stations"]
	var relics: Dictionary = _fallback_progress["relics"]
	var unlocked: Dictionary = relics.get("unlockedRelics", {})
	match task_id:
		"s1", "S1", "s1_order":
			st["s1_order"] = true
			unlocked["whistle"] = true
		"s2", "S2", "s2_rewrite":
			st["s2_rewrite"] = true
			st["s2_vs_branch"] = true
			st["s2_kettle"] = true
			unlocked["arrow"] = true
		"s3", "S3", "s3_timing":
			st["s3_timing"] = true
			unlocked["knob"] = true
	relics["unlockedRelics"] = unlocked
	_fallback_progress["stations"] = st
	_fallback_progress["relics"] = relics


func _call_promise(promise: Variant, cb: JavaScriptObject) -> void:
	if promise == null:
		return
	promise.then(cb).catch(cb)


func _on_report_js(args: Array) -> void:
	# Promise resolve/reject 都进这里；resolve 时 args[0] 为 progress
	if args.is_empty():
		station_reported.emit(_pending_task, false, "上报无返回")
		return
	var val: Variant = args[0]
	# Error-like
	if typeof(val) == TYPE_OBJECT:
		var msg := str(val)
		if msg.find("Error") >= 0 or msg.find("未登录") >= 0 or msg.find("失败") >= 0:
			station_reported.emit(_pending_task, false, msg)
			return
	var prog := _js_to_dict(val)
	if prog.has("stations") or prog.has("relics"):
		station_reported.emit(_pending_task, true, "已上报")
		progress_updated.emit(prog)
	else:
		# reject Error object serialized oddly
		station_reported.emit(_pending_task, false, str(val))


func _on_relic_js(args: Array) -> void:
	if args.is_empty():
		relic_used.emit(false, "法宝无返回", -1)
		return
	var val: Variant = args[0]
	var d := _js_to_dict(val)
	if d.has("hint") or d.has("relics") or d.has("progress"):
		var remaining := 0
		if d.has("relics"):
			remaining = int(d["relics"].get("remaining", 0))
		elif d.has("progress"):
			var p: Dictionary = d["progress"]
			remaining = int(p.get("relics", {}).get("remaining", 0))
			progress_updated.emit(p)
		relic_used.emit(true, str(d.get("hint", "原理解析占位")), remaining)
		if d.has("progress"):
			progress_updated.emit(d["progress"])
	else:
		relic_used.emit(false, str(val), -1)


func _on_refresh_js(args: Array) -> void:
	if args.is_empty():
		return
	var prog := _js_to_dict(args[0])
	if prog.has("stations") or prog.has("relics"):
		progress_updated.emit(prog)


func _js_to_dict(val: Variant) -> Dictionary:
	if val == null:
		return {}
	if typeof(val) == TYPE_DICTIONARY:
		return val
	# JavaScriptObject：用 JSON 绕一圈最稳
	if OS.has_feature("web"):
		var JSON_obj = JavaScriptBridge.get_interface("JSON")
		if JSON_obj:
			var raw: Variant = JSON_obj.stringify(val)
			if typeof(raw) == TYPE_STRING:
				var parsed: Variant = JSON.parse_string(raw)
				if typeof(parsed) == TYPE_DICTIONARY:
					return parsed
	return {}


func _dict_to_js(d: Dictionary) -> Variant:
	if not OS.has_feature("web"):
		return d
	if d.is_empty():
		return JavaScriptBridge.eval("({})", true)
	var raw := JSON.stringify(d)
	var JSON_obj = JavaScriptBridge.get_interface("JSON")
	if JSON_obj:
		return JSON_obj.parse(raw)
	return JavaScriptBridge.eval("(%s)" % raw, true)
