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
		board.prompt_label.text = "阿莲：休息点的壶也在反复加热，先标清楚。\n补条件、反复步骤，并标『先问再做』。"

func highlight_for_relic() -> String:
	_ensure()
	return board.highlight_next()

func _on_sub(ok: bool, detail: Dictionary) -> void:
	if not ok:
		var n := GameState.bump_fail(GameState.TASK_S2C)
		ClassroomBridge.request_scaffold(GameState.TASK_S2C, mini(n, 3), "M5")
		if board.feedback_label:
			board.feedback_label.text = _hint(n)
		return
	var cond := str(detail.get("conditionCardId", detail.get("filled", {}).get("decide", "")))
	var filled: Dictionary = detail.get("filled", {})
	var timing := str(filled.get("timing", "k_timing_ask_first"))
	var repeat_id := "k_repeat_check"
	if filled.has("heat"):
		repeat_id = "k_repeat_heat"
	elif filled.has("check"):
		repeat_id = "k_repeat_check"
	completed.emit({
		"evidenceCode": "E3",
		"attemptKind": "first" if int(GameState.fail_counts.get(GameState.TASK_S2C, 0)) == 0 else "revision",
		"correct": true,
		"payload": {
			"capture": "in_world_action",
			"conditionId": cond if cond != "" else "k_cond",
			"repeatStepId": repeat_id,
			"timingChoice": "ask_first" if timing.ends_with("ask_first") else "do_first",
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
	# 简化：缺检测、菱形、加热、时机；是回检测；否停
	var nodes := [
		{"id": "start", "kind": FlowBoardScr.NodeKind.START, "text": "开始保温", "pos": Vector2(360, 4), "size": Vector2(200, 36)},
		{"id": "check", "kind": FlowBoardScr.NodeKind.PROCESS, "text": "", "placeholder": "（填：检测水温）", "pos": Vector2(350, 55), "size": Vector2(220, 40), "slot": true},
		{"id": "decide", "kind": FlowBoardScr.NodeKind.DECISION, "text": "", "placeholder": "（填条件）", "pos": Vector2(330, 115), "size": Vector2(260, 64), "slot": true},
		{"id": "heat", "kind": FlowBoardScr.NodeKind.PROCESS, "text": "", "placeholder": "（填：继续加热）", "pos": Vector2(80, 130), "size": Vector2(180, 40), "slot": true},
		{"id": "stop", "kind": FlowBoardScr.NodeKind.PROCESS, "text": "停止加热", "pos": Vector2(360, 230), "size": Vector2(200, 40)},
		{"id": "end", "kind": FlowBoardScr.NodeKind.END, "text": "可以倒水", "pos": Vector2(360, 295), "size": Vector2(200, 36)},
		{"id": "timing", "kind": FlowBoardScr.NodeKind.PROCESS, "text": "", "placeholder": "（时机标签）", "pos": Vector2(700, 55), "size": Vector2(200, 40), "slot": true},
	]
	return {
		"mode": "fill",
		"submit_text": "锁定通关",
		"nodes": nodes,
		"fixed_edges": [
			{"from": "start", "to": "check"},
			{"from": "stop", "to": "end"},
		],
		"cards": [
			{"id": "k_cond", "text": "水温是否低于设定？"},
			{"id": "k_repeat_heat", "text": "继续加热"},
			{"id": "k_repeat_check", "text": "检测水温"},
			{"id": "k_timing_ask_first", "text": "先问再做"},
			{"id": "k_timing_do_first", "text": "先做再问"},
			{"id": "k_cond_100", "text": "是不是正好 100℃？"},
			{"id": "k_branch_like", "text": "要红茶还是绿茶？"},
			{"id": "k_stop_as_repeat", "text": "到达对面"},
		],
		"slot_order": ["check", "decide", "heat", "timing", "wire:yes", "wire:no"],
		"slot_tips": {
			"check": "点「检测水温」填入反复／先问步",
			"decide": "点「水温是否低于设定？」填菱形",
			"heat": "点「继续加热」",
			"timing": "点「先问再做」",
			"wire:yes": "点『是』再点『检测水温』或『继续加热』旁路径目标——接到检测",
			"wire:no": "点『否』再点『停止加热』",
		},
		"expect": {
			"slots": {
				"check": "k_repeat_check",
				"decide": "k_cond",
				"heat": "k_repeat_heat",
				"timing": "k_timing_ask_first",
			},
			"wires": {"yes": "check", "no": "stop"},
		},
		"ok_feedback": "壶短循环：检测→不够加热→再检测…直到可倒水 ✓",
		"bad_feedback": "壶空转或一直加热不判停。⌫ 重贴。",
		"idle_feedback": "保温壶待命（先问够不够，再决定要不要加热）",
	}
