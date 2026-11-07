extends Control
## S2-C 保温壶教材式小流程图（E3／s2_kettle）；学生可见禁术语

signal completed(payload: Dictionary)
signal cancelled

const FlowBoardScr = preload("res://scripts/ui/flowchart_board.gd")

var board: Control

func _ready() -> void:
	_ensure()

func _ensure() -> void:
	if board != null:
		return
	var panel := get_node_or_null("Panel") as PanelContainer
	if panel == null:
		panel = PanelContainer.new()
		panel.name = "Panel"
		panel.position = Vector2(80, 50)
		panel.size = Vector2(1120, 580)
		add_child(panel)
	for c in panel.get_children():
		c.queue_free()
	var host := Control.new()
	host.custom_minimum_size = Vector2(1080, 540)
	panel.add_child(host)
	board = FlowBoardScr.new()
	board.set_anchors_preset(Control.PRESET_FULL_RECT)
	host.add_child(board)
	board.setup(_config())
	board.submitted.connect(_on_sub)
	board.cancelled.connect(func(): cancelled.emit())

func open_station() -> void:
	visible = true
	_ensure()
	board.setup(_config())
	board.open_board()
	if board.prompt_label:
		board.prompt_label.text = "看看热水壶什么时候加热、什么时候停止。"

func highlight_for_relic() -> String:
	_ensure()
	return board.highlight_next()

func _on_sub(ok: bool, detail: Dictionary) -> void:
	if not ok:
		ClassroomBridge.report_evidence({"eventType": "attempt", "eventId": "%s-attempt-%s-%s" % [GameState.TASK_S2C, Time.get_unix_time_from_system(), Time.get_ticks_usec()], "taskId": GameState.TASK_S2C, "correct": false, "payload": {"detail": detail, "supportUsed": board._support_used or int(GameState.fail_counts.get(GameState.TASK_S2C, 0)) > 0}})
		var n := GameState.bump_fail(GameState.TASK_S2C)
		ClassroomBridge.request_scaffold(GameState.TASK_S2C, mini(n, 3), "M5")
		if board.feedback_label:
			board.feedback_label.text = _hint(n)
		return
	var cond := "water_below_100"
	var filled: Dictionary = detail.get("filled", {})
	var timing := str(filled.get("timing", ""))
	var repeat_id := str(filled.get("repeat", ""))
	completed.emit({
		"evidenceCode": "E3",
		"attemptKind": "first" if int(GameState.fail_counts.get(GameState.TASK_S2C, 0)) == 0 else "revision",
		"correct": true,
		"payload": {
			"capture": "in_world_action",
			"supportUsed": board._support_used or int(GameState.fail_counts.get(GameState.TASK_S2C, 0)) > 0,
			"conditionId": cond if cond != "" else "k_cond",
			"repeatStepId": repeat_id,
			"timingChoice": "ask_first" if timing == "k_timing_ask_first" else "do_first",
			"stopChoice": filled.get("stop_choice", ""),
			"caseResults": detail.get("caseResults", []),
			"attemptHistory": detail.get("attemptHistory", []),
		},
	})

func _hint(n: int) -> String:
	match n:
		1:
			return "图上先出现问句还是加热？菱形里能否答是或否？"
		2:
			return "先问：不够才加热。反复的是加热／检测，不是结束。"
		_:
			return "对照空调冷气小图想『先问／先做』，不引入术语。"

func _config() -> Dictionary:
	# 完整教材流程图加三个认读问题，不要求从零搭图。
	var nodes := [
		{"id": "start", "kind": FlowBoardScr.NodeKind.START, "text": "开始烧水", "pos": Vector2(245, 0), "size": Vector2(170, 32)},
		{"id": "check", "kind": FlowBoardScr.NodeKind.PROCESS, "text": "读取水温", "pos": Vector2(245, 45), "size": Vector2(170, 36)},
		{"id": "decide", "kind": FlowBoardScr.NodeKind.DECISION, "text": "水温低于100℃？", "pos": Vector2(220, 98), "size": Vector2(220, 60)},
		{"id": "heat", "kind": FlowBoardScr.NodeKind.PROCESS, "text": "继续加热", "pos": Vector2(25, 110), "size": Vector2(150, 36)},
		{"id": "stop", "kind": FlowBoardScr.NodeKind.PROCESS, "text": "停止加热", "pos": Vector2(245, 205), "size": Vector2(170, 36)},
		{"id": "end", "kind": FlowBoardScr.NodeKind.END, "text": "结束", "pos": Vector2(245, 255), "size": Vector2(170, 32)},
		{"id": "repeat", "kind": FlowBoardScr.NodeKind.PROCESS, "text": "", "placeholder": "选出反复的步骤", "pos": Vector2(535, 40), "size": Vector2(220, 38), "slot": true},
		{"id": "stop_choice", "kind": FlowBoardScr.NodeKind.PROCESS, "text": "", "placeholder": "选停止加热的条件", "pos": Vector2(535, 100), "size": Vector2(220, 38), "slot": true},
		{"id": "timing", "kind": FlowBoardScr.NodeKind.PROCESS, "text": "", "placeholder": "看看先做什么", "pos": Vector2(535, 160), "size": Vector2(220, 38), "slot": true},
	]
	return {
		"mode": "fill", "hide_handles": true, "kettle_diagram": true, "kettle_simulation": true,
		"submit_text": "运行80℃", "nodes": nodes,
		"prompt": "看热水壶的流程，选出反复、停止和先后。",
		"fixed_edges": [
			{"from": "start", "to": "check"}, {"from": "check", "to": "decide"},
			{"from": "decide", "to": "stop"}, {"from": "stop", "to": "end"},
		],
		"cards": [
			{"id": "k_repeat_check", "text": "读取水温", "slot": "repeat"},
			{"id": "k_repeat_heat", "text": "继续加热", "slot": "repeat"},
			{"id": "k_repeat_stop", "text": "停止加热", "slot": "repeat"},
			{"id": "k_stop_at_100", "text": "达到或高于100℃", "slot": "stop_choice"},
			{"id": "k_stop_below", "text": "低于100℃", "slot": "stop_choice"},
			{"id": "k_stop_random", "text": "每次都停止", "slot": "stop_choice"},
			{"id": "k_timing_ask_first", "text": "先判断水温", "slot": "timing"},
			{"id": "k_timing_do_first", "text": "先直接加热", "slot": "timing"},
		],
		"slot_order": ["repeat", "stop_choice", "timing"],
		"slot_tips": {
			"repeat": "观察图，选择一个会再做的步骤",
			"stop_choice": "选择什么时候停止加热",
			"timing": "选择第一次先判断还是先加热",
		},
		"expect": {"slots": {"repeat": ["k_repeat_check", "k_repeat_heat"], "stop_choice": "k_stop_at_100", "timing": "k_timing_ask_first"}},
		"ok_feedback": "读取、判断；不够再加热，达到后停止。",
		"bad_feedback": "看看箭头与温度，再修改你的选择。",
		"idle_feedback": "热水壶流程图在左侧。",
	}
