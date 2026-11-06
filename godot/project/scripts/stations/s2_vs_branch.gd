extends Control
## S2-A/B：循环≠分支点选＋回边高亮（E2／s2_vs_branch）

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
		board.prompt_label.text = "①信号屏说不清『再等』停在哪。\n两张屏都有菱形。哪张在问还要不要再做？再标出绕回的箭头。"

func highlight_for_relic() -> String:
	_ensure()
	return board.highlight_next()

func _on_sub(ok: bool, detail: Dictionary) -> void:
	if not ok:
		var n := GameState.bump_fail(GameState.TASK_S2B)
		ClassroomBridge.request_scaffold(GameState.TASK_S2B, mini(n, 3), "M1")
		if board.feedback_label:
			board.feedback_label.text = _hint(n)
		return
	completed.emit({
		"evidenceCode": "E2",
		"attemptKind": "first" if int(GameState.fail_counts.get(GameState.TASK_S2B, 0)) == 0 else "revision",
		"correct": true,
		"payload": {
			"capture": "in_world_action",
			"selectedSide": detail.get("side", "loop"),
			"highlightedBackEdge": bool(detail.get("highlightedBackEdge", true)),
		},
	})

func _hint(n: int) -> String:
	match n:
		1:
			return "两屏出口一样多吗？有没有箭头绕回来？"
		2:
			return "选路各走一次；循环是再做一遍。"
		_:
			return "弯回去的那条，才是『再做』。（示意，不代点）"

func _config() -> Dictionary:
	return {
		"mode": "pick_side",
		"need_back_highlight": true,
		"back_target": "observe",
		"submit_text": "锁定通关",
		"prompt": "点左屏＝循环；再点灰显回边确认『再做』。",
		"cards": [
			{"id": "intent_loop", "text": "这张在问：还要不要再做？"},
			{"id": "intent_branch", "text": "这张在问：走哪一条路？"},
			{"id": "intent_count", "text": "必须先知道做几次"},
			{"id": "mark_back_edge", "text": "绕回来的箭头＝再做一遍"},
			{"id": "mark_branch_exit", "text": "两个出口＝两条不同的路"},
		],
		"slot_tips": {
			"pick": "点左侧循环屏，或点标签『还要不要再做』",
			"wire:yes": "再点左屏绕回的『是』回边，确认高亮",
		},
		"expect": {"side": "loop"},
		"ok_feedback": "灯柱再闪一轮；回边描亮 ✓",
		"bad_feedback": "阿莲：这是选路，不是再做。",
	}
