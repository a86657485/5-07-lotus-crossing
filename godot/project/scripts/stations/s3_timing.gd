extends Control
## 先观察一轮，再修改并在相同条件下运行；结果是简化教学仿真。

signal completed(payload: Dictionary)
signal cancelled

const STRATEGY_OK := "st_car_long"
const REASON_OK := "rs_evacuate"
const GREEN_UNITS := {"st_same": 3, STRATEGY_OK: 6, "st_longest": 9}
const INITIAL_CARS := 12
const PEDESTRIAN_UNITS := 6

class RoadView extends Control:
	var remaining: int = 12
	var has_run: bool = false

	func _draw() -> void:
		var w := size.x
		var h := size.y
		draw_rect(Rect2(0, 0, w, h), Color("#a8d982"))
		draw_rect(Rect2(0, h * 0.27, w, h * 0.46), Color("#6e8090"))
		draw_rect(Rect2(w * 0.42, 0, w * 0.16, h), Color("#6e8090"))
		draw_line(Vector2(0, h * 0.5), Vector2(w * 0.38, h * 0.5), Color("#f6dc8c"), 2)
		draw_line(Vector2(w * 0.62, h * 0.5), Vector2(w, h * 0.5), Color("#f6dc8c"), 2)
		for i in range(5):
			draw_rect(Rect2(w * 0.42 + 6 + i * (w * 0.16 - 12) / 5, h * 0.27 - 13, 9, 13), Color("#ffffff"))
			draw_rect(Rect2(w * 0.42 + 6 + i * (w * 0.16 - 12) / 5, h * 0.73, 9, 13), Color("#ffffff"))
		for i in range(3):
			draw_circle(Vector2(26 + i * 37, 22 + (i % 2) * 10), 15, Color("#65b267"))
			draw_circle(Vector2(w - 26 - i * 37, h - 22 - (i % 2) * 10), 15, Color("#65b267"))
		for i in range(remaining):
			var car_x := w * 0.39 - 26.0 - (i % 6) * 30.0
			var car_y := h * 0.34 + int(i / 6) * 27.0
			draw_rect(Rect2(car_x, car_y, 22, 15), Color("#f7b35c"))
			draw_rect(Rect2(car_x + 4, car_y + 2, 9, 6), Color("#d6f2f7"))
			draw_circle(Vector2(car_x + 5, car_y + 15), 3, Color("#28394d"))
			draw_circle(Vector2(car_x + 17, car_y + 15), 3, Color("#28394d"))
		var signal_color := Color("#35b779") if has_run else Color("#e46d62")
		draw_circle(Vector2(w * 0.40, h * 0.25), 7, signal_color)

var fault_observed := false
var strategy_id := ""
var reason_id := ""
var rule_changed := false
var revalidate_ok := false
var first_attempt: Dictionary = {}
var run_history: Array = []
var edit_history: Array = []
var revision_count := 0
var last_remaining := INITIAL_CARS

@onready var prompt: Label = $Panel/VBox/Prompt
@onready var traffic_l: Label = $Panel/VBox/TrafficBar
@onready var run_btn: Button = $Panel/VBox/Tools/RunBtn
@onready var undo_btn: Button = $Panel/VBox/Tools/UndoBtn
@onready var strat_row: HBoxContainer = $Panel/VBox/StratRow
@onready var reason_row: HBoxContainer = $Panel/VBox/ReasonRow
@onready var submit_btn: Button = $Panel/VBox/Tools/SubmitBtn
@onready var back_btn: Button = $Panel/VBox/Tools/BackBtn
@onready var gate_l: Label = $Panel/VBox/GateHint
var road: RoadView

func _ready() -> void:
	run_btn.pressed.connect(_run)
	undo_btn.visible = true
	undo_btn.pressed.connect(_undo)
	submit_btn.pressed.connect(_submit)
	back_btn.pressed.connect(func(): cancelled.emit())
	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = Color("#fffaf0")
	panel_style.border_color = Color("#78b9e7")
	panel_style.set_border_width_all(3)
	panel_style.set_corner_radius_all(18)
	panel_style.content_margin_left = 18
	panel_style.content_margin_right = 18
	panel_style.content_margin_top = 12
	panel_style.content_margin_bottom = 12
	$Panel.add_theme_stylebox_override("panel", panel_style)
	for label in [prompt, traffic_l, gate_l]:
		label.add_theme_color_override("font_color", Color("#183e66"))
	var visual := HBoxContainer.new()
	visual.add_theme_constant_override("separation", 16)
	$Panel/VBox.add_child(visual)
	$Panel/VBox.move_child(visual, 1)
	road = RoadView.new()
	road.custom_minimum_size = Vector2(500, 180)
	road.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	visual.add_child(road)
	$Panel/VBox.remove_child(traffic_l)
	traffic_l.custom_minimum_size = Vector2(420, 0)
	traffic_l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	traffic_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	visual.add_child(traffic_l)
	_fill()
	for button in [run_btn, undo_btn, submit_btn, back_btn]:
		_style_button(button)

func open_station() -> void:
	visible = true
	var saved: Dictionary = GameState.s3_detail
	fault_observed = bool(saved.get("faultObserved", false))
	strategy_id = str(saved.get("strategy", ""))
	reason_id = str(saved.get("reason", ""))
	rule_changed = bool(saved.get("ruleChanged", false))
	revalidate_ok = bool(saved.get("revalidateOk", false))
	first_attempt = saved.get("firstAttempt", {}).duplicate(true)
	run_history = saved.get("runHistory", []).duplicate(true)
	revision_count = int(saved.get("revisionCount", 0))
	edit_history.clear()
	last_remaining = int(saved.get("lastRemaining", INITIAL_CARS))
	prompt.text = "路口堵了，帮阿莲调整信号时长。\n先观察，再换方案运行比较。"
	road.remaining = last_remaining
	road.has_run = fault_observed
	road.queue_redraw()
	if run_history.is_empty():
		traffic_l.text = "教学仿真：同一方向有 12 辆车等待。"
	else:
		_show_result(run_history.back())
	_update_gate()

func _fill() -> void:
	_btn(strat_row, "绿灯 3 格", "st_same", "strat")
	_btn(strat_row, "绿灯 6 格", STRATEGY_OK, "strat")
	_btn(strat_row, "绿灯 9 格", "st_longest", "strat")
	_btn(reason_row, "让更多等待的车通行", REASON_OK, "reason")
	_btn(reason_row, "这一侧车辆很少", "rs_few", "reason")
	_btn(reason_row, "数字好看就行", "rs_random", "reason")

func _btn(parent: HBoxContainer, text: String, id: String, kind: String) -> void:
	var b := Button.new()
	b.text = text
	b.toggle_mode = true
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_style_button(b)
	b.pressed.connect(_pick.bind(kind, id))
	parent.add_child(b)

func _style_button(b: Button) -> void:
	var normal := StyleBoxFlat.new()
	normal.bg_color = Color("#e3f1fb")
	normal.border_color = Color("#75add9")
	normal.set_border_width_all(2)
	normal.set_corner_radius_all(9)
	normal.content_margin_left = 12
	normal.content_margin_right = 12
	normal.content_margin_top = 7
	normal.content_margin_bottom = 7
	var hover := normal.duplicate() as StyleBoxFlat
	hover.bg_color = Color("#cce8fa")
	var pressed := normal.duplicate() as StyleBoxFlat
	pressed.bg_color = Color("#3687c5")
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", hover)
	b.add_theme_stylebox_override("pressed", pressed)
	b.add_theme_stylebox_override("hover_pressed", pressed)
	b.add_theme_color_override("font_color", Color("#153b60"))
	b.add_theme_color_override("font_hover_color", Color("#153b60"))
	b.add_theme_color_override("font_pressed_color", Color("#ffffff"))

func _pick(kind: String, id: String) -> void:
	if not fault_observed:
		gate_l.text = "先运行，看哪一侧等待的车多。"
		_update_buttons()
		return
	var old := strategy_id if kind == "strat" else reason_id
	if old == id:
		_update_buttons()
		return
	edit_history.append({"kind": kind, "previous": old})
	if not first_attempt.is_empty():
		revision_count += 1
	if kind == "strat":
		strategy_id = id
	else:
		reason_id = id
	rule_changed = true
	revalidate_ok = false
	_update_gate()

func _undo() -> void:
	if edit_history.is_empty():
		gate_l.text = "还没有可以撤回的选择。"
		return
	var edit: Dictionary = edit_history.pop_back()
	if edit.kind == "strat":
		strategy_id = str(edit.previous)
	else:
		reason_id = str(edit.previous)
	if not first_attempt.is_empty():
		revision_count += 1
	rule_changed = strategy_id != "" or reason_id != ""
	revalidate_ok = false
	_update_gate()

func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("undo_step"):
		_undo()
		get_viewport().set_input_as_handled()

func _run() -> void:
	if not fault_observed:
		fault_observed = true
		var baseline := _simulate(3)
		baseline["kind"] = "baseline"
		run_history.append(baseline)
		_show_result(baseline)
		_report_run(baseline)
		_update_gate()
		return
	if strategy_id == "" or reason_id == "":
		gate_l.text = "先选择时长和理由，再运行。"
		return
	var result := _simulate(int(GREEN_UNITS.get(strategy_id, 3)))
	result["kind"] = "attempt"
	result["strategy"] = strategy_id
	result["reason"] = reason_id
	result["correct"] = strategy_id != "st_same" and reason_id == REASON_OK
	run_history.append(result)
	if first_attempt.is_empty():
		first_attempt = result.duplicate(true)
	revalidate_ok = bool(result.correct)
	_show_result(result)
	_report_run(result)
	if not revalidate_ok:
		var n := GameState.bump_fail(GameState.TASK_S3)
		ClassroomBridge.request_scaffold(GameState.TASK_S3, mini(n, 3), "M7")
	_update_gate()

func _report_run(result: Dictionary) -> void:
	var event_id := "%s-%s-%s" % [GameState.TASK_S3, str(Time.get_unix_time_from_system()), str(Time.get_ticks_usec())]
	ClassroomBridge.report_evidence({
		"taskId": GameState.TASK_S3,
		"eventType": "simulation_run",
		"eventId": event_id,
		"dedupeKey": event_id,
		"evidenceCode": "E4",
		"payload": result.duplicate(true),
	})

func _simulate(green_units: int) -> Dictionary:
	# 用缩短的仿真时间格，不能按真实路口秒数或安全标准理解。
	return {
		"greenUnits": green_units,
		"initialCars": INITIAL_CARS,
		"passedCars": mini(INITIAL_CARS, green_units),
		"remainingCars": maxi(0, INITIAL_CARS - green_units),
		"pedestrianUnits": PEDESTRIAN_UNITS,
	}

func _show_result(result: Dictionary) -> void:
	last_remaining = int(result.remainingCars)
	road.remaining = last_remaining
	road.has_run = true
	road.queue_redraw()
	var before := "原方案" if result.kind == "baseline" else "本次方案"
	traffic_l.text = "%s\n绿灯 %d 格：通过 %d 辆，还等 %d 辆。\n\n教学仿真：每格最多通行 1 辆；行人阶段固定 6 格。时间已缩短，不是真实路口时长。" % [
		before, result.greenUnits, result.passedCars, result.remainingCars
	]
	if result.kind == "attempt":
		traffic_l.text += "\n\n原方案还等 9 辆；绿灯越长，其他方向等得也越久。"

func _update_buttons() -> void:
	var ids := ["st_same", STRATEGY_OK, "st_longest"]
	for i in range(strat_row.get_child_count()):
		var b := strat_row.get_child(i) as Button
		b.disabled = not fault_observed
		b.set_pressed_no_signal(ids[i] == strategy_id)
	var reason_ids := [REASON_OK, "rs_few", "rs_random"]
	for i in range(reason_row.get_child_count()):
		var b := reason_row.get_child(i) as Button
		b.disabled = not fault_observed
		b.set_pressed_no_signal(reason_ids[i] == reason_id)

func _update_gate() -> void:
	_update_buttons()
	var gate := "pre_missing"
	if not fault_observed:
		gate_l.text = "先点“运行路口”，观察等待情况。"
	elif strategy_id == "":
		gate = "pre_done_unverified"
		gate_l.text = "选择车多方向的绿灯时长。"
	elif reason_id == "":
		gate = "pre_done_unverified"
		gate_l.text = "选择调整时长的理由。"
	elif not revalidate_ok:
		gate = "pre_done_unverified"
		var latest: Dictionary = run_history.back() if not run_history.is_empty() else {}
		if latest.get("kind", "") == "attempt" and latest.get("strategy", "") == strategy_id and latest.get("reason", "") == reason_id:
			gate_l.text = "看看结果和理由，修改后再运行。"
		else:
			gate_l.text = "再运行，比较两次结果。"
	else:
		gate = "verified_ready"
		gate_l.text = "比较完成，可以确认。"
	ClassroomBridge.gate_state(GameState.TASK_S3, gate)
	GameState.s3_detail = {
		"faultObserved": fault_observed,
		"scenario": "car_heavy",
		"strategy": strategy_id,
		"reason": reason_id,
		"ruleChanged": rule_changed,
		"revalidateOk": revalidate_ok,
		"firstAttempt": first_attempt.duplicate(true),
		"runHistory": run_history.duplicate(true),
		"revisionCount": revision_count,
		"lastRemaining": last_remaining,
	}
	ClassroomBridge.emit_to_js("progress:s3Detail", GameState.s3_detail)

func _submit() -> void:
	if not (fault_observed and revalidate_ok):
		gate_l.text = "先选时长和理由，再运行比较。"
		return
	completed.emit({
		"evidenceCode": "E4",
		"attemptKind": "revision" if revision_count > 0 or not bool(first_attempt.get("correct", false)) else "first",
		"correct": true,
		"payload": {
			"capture": "in_world_action",
			"faultObserved": true,
			"strategyId": strategy_id,
			"reasonId": reason_id,
			"revalidateOk": true,
			"firstAttempt": first_attempt.duplicate(true),
			"runHistory": run_history.duplicate(true),
			"revisionCount": revision_count,
		},
		"s3Detail": GameState.s3_detail.duplicate(true),
	})
