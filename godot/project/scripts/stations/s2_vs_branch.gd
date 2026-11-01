extends Control
## S2-B 并排意图屏：循环 vs 分支

signal completed(payload: Dictionary)
signal cancelled

var selected_side: String = ""  # loop | branch
var highlighted_back: bool = false

@onready var prompt: Label = $Panel/VBox/Prompt
@onready var anim_l: Label = $Panel/VBox/AnimFeedback
@onready var loop_btn: Button = $Panel/VBox/Screens/LoopBtn
@onready var branch_btn: Button = $Panel/VBox/Screens/BranchBtn
@onready var edge_btn: Button = $Panel/VBox/EdgeBtn
@onready var submit_btn: Button = $Panel/VBox/Tools/SubmitBtn
@onready var back_btn: Button = $Panel/VBox/Tools/BackBtn

func _ready() -> void:
	loop_btn.pressed.connect(func(): _select("loop"))
	branch_btn.pressed.connect(func(): _select("branch"))
	edge_btn.pressed.connect(_highlight_edge)
	submit_btn.pressed.connect(_submit)
	back_btn.pressed.connect(func(): cancelled.emit())

func open_station() -> void:
	visible = true
	selected_side = ""
	highlighted_back = false
	prompt.text = "两张屏都有菱形。哪张在问还要不要再做？"
	anim_l.text = "点选后看灯柱／行人动画。"
	# 未作答零高亮：不改按钮主题色暗示答案

func _select(side: String) -> void:
	selected_side = side
	if side == "loop":
		anim_l.text = "灯柱再闪一轮观察动画（循环）"
	else:
		anim_l.text = "行人一次性走天桥或等灯，不再绕回（分支）"

func _highlight_edge() -> void:
	highlighted_back = true
	anim_l.text = "回边高亮：条件成立就再走一遍。"
	if selected_side == "":
		selected_side = "loop"

func _submit() -> void:
	var ok := selected_side == "loop" or highlighted_back
	if not ok:
		var n := GameState.bump_fail(GameState.TASK_S2B)
		ClassroomBridge.request_scaffold(GameState.TASK_S2B, mini(n, 3), "M1")
		anim_l.text = "两屏出口一样多吗？有没有箭头绕回来？"
		return
	completed.emit({
		"evidenceCode": "E2",
		"attemptKind": "first" if int(GameState.fail_counts.get(GameState.TASK_S2B, 0)) == 0 else "revision",
		"correct": true,
		"payload": {
			"capture": "in_world_action",
			"selectedSide": selected_side,
			"highlightedBackEdge": highlighted_back,
		},
	})
