extends Control
## S1 主交互（E1／D1）：教材过马路循环图补菱形＋是回边／否前进
## 主证据 taskId=s2_rewrite／evidenceCode=E1；禁止空位1–5

signal completed(payload: Dictionary)
signal cancelled

const FlowBoardScr = preload("res://scripts/ui/flowchart_board.gd")

var board: Control

func _ready() -> void:
	_ensure_board()

func _ensure_board() -> void:
	if board != null:
		return
	var panel := get_node_or_null("Panel") as PanelContainer
	if panel == null:
		panel = PanelContainer.new()
		panel.name = "Panel"
		panel.position = Vector2(60, 36)
		panel.size = Vector2(1160, 620)
		add_child(panel)
	for c in panel.get_children():
		c.queue_free()
	var host := Control.new()
	host.name = "BoardHost"
	host.custom_minimum_size = Vector2(1120, 580)
	panel.add_child(host)
	board = FlowBoardScr.new()
	board.name = "FlowchartBoard"
	board.set_anchors_preset(Control.PRESET_FULL_RECT)
	host.add_child(board)
	board.setup(_config())
	board.submitted.connect(_on_submitted)
	board.cancelled.connect(func(): cancelled.emit())

func open_station() -> void:
	visible = true
	_ensure_board()
	board.setup(_config())
	board.open_board()
	if board.prompt_label:
		board.prompt_label.text = "①开放日队伍乱了，有人要乱穿。\n②帮阿莲把『一直等』画成带回箭头的图。\n③接对了，行人会按序走；灯会再闪再停。"

func highlight_for_relic() -> String:
	_ensure_board()
	return board.highlight_next()

func _on_submitted(ok: bool, detail: Dictionary) -> void:
	if not ok:
		var n := GameState.bump_fail(GameState.TASK_S2A)
		ClassroomBridge.request_scaffold(GameState.TASK_S2A, mini(n, 3), "M2")
		if board and board.feedback_label:
			board.feedback_label.text = _hint(n)
			board.feedback_label.modulate = Color(1.0, 0.55, 0.2)
		return
	completed.emit({
		"evidenceCode": "E1",
		"attemptKind": "first" if int(GameState.fail_counts.get(GameState.TASK_S2A, 0)) == 0 else "revision",
		"correct": true,
		"payload": {
			"capture": "in_world_action",
			"conditionCardId": detail.get("conditionCardId", "cond_green_off"),
			"repeatCardId": "observe",
			"backEdgeTo": detail.get("backEdgeTo", "observe"),
			"noEdgeTo": detail.get("noEdgeTo", "cross"),
			"lightReplay": detail.get("lightReplay", "loop_then_exit"),
		},
	})

func _hint(n: int) -> String:
	match n:
		1:
			return "看看行人卡在哪；菱形里要能答是或否。"
		2:
			return "『是』的箭头该指回还在做的那步吗？到达对面还要再做吗？"
		_:
			return "对照换地名示意图：菱形问未亮？是→弯回观察；否→过马路。"

func _config() -> Dictionary:
	var nodes := [
		{"id": "start", "kind": FlowBoardScr.NodeKind.START, "text": "到达十字路口", "pos": Vector2(360, 6), "size": Vector2(220, 40)},
		{"id": "observe", "kind": FlowBoardScr.NodeKind.PROCESS, "text": "原地观察红绿灯", "pos": Vector2(360, 70), "size": Vector2(220, 44)},
		{"id": "decide", "kind": FlowBoardScr.NodeKind.DECISION, "text": "", "placeholder": "（填：绿灯未亮起？）", "pos": Vector2(340, 145), "size": Vector2(260, 72), "slot": true},
		{"id": "cross", "kind": FlowBoardScr.NodeKind.PROCESS, "text": "过马路", "pos": Vector2(360, 260), "size": Vector2(220, 44)},
		{"id": "end", "kind": FlowBoardScr.NodeKind.END, "text": "到达马路对面", "pos": Vector2(360, 330), "size": Vector2(220, 40)},
	]
	return {
		"mode": "fill",
		"prompt": "把正确判断放进菱形；点『是』再点观察框；点『否』再点过马路。",
		"submit_text": "锁定并回放",
		"nodes": nodes,
		"fixed_edges": [
			{"from": "start", "to": "observe"},
			{"from": "cross", "to": "end"},
		],
		"cards": [
			{"id": "cond_green_off", "text": "绿灯未亮起？"},
			{"id": "cond_bridge", "text": "有可用天桥？"},
			{"id": "cond_count", "text": "已经等了三次？"},
			{"id": "act_as_diamond", "text": "原地观察红绿灯"},
			{"id": "cond_arrive", "text": "到达对面了吗？"},
		],
		"slot_order": ["decide", "wire:yes", "wire:no"],
		"slot_tips": {
			"decide": "点底部卡片「绿灯未亮起？」填入菱形空槽",
			"wire:yes": "点菱形旁橙色『是』拉线柄，再点『原地观察红绿灯』",
			"wire:no": "点菱形旁『否』拉线柄，再点『过马路』",
		},
		"expect": {
			"slots": {"decide": "cond_green_off"},
			"wires": {"yes": "observe", "no": "cross"},
			"repeatCardId": "observe",
		},
		"ok_feedback": "灯再闪一轮观察→亮了→行人有序过马路 ✓",
		"bad_feedback": "阿莲：看，有人挤出斑马线了！⌫ 撤回重锁",
		"idle_feedback": "行人在路口等待流程图布置…",
		"preview_ok": "结构接上了——锁定后看灯／行人回放。",
		"relic_ready": "可以锁定了。法宝：把一直等改成『问还要不要再观察』。",
	}
