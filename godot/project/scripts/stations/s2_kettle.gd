extends Control
## S2-C 保温壶三标签；禁「循环体」文案

signal completed(payload: Dictionary)
signal cancelled

const COND_OK := "water_low"
const REPEAT_OK := "keep_heat"
const TIMING_OK := "ask_first"

var condition_id: String = ""
var repeat_step_id: String = ""
var timing_choice: String = ""
var _history: Array = []

@onready var prompt: Label = $Panel/VBox/Prompt
@onready var pot_l: Label = $Panel/VBox/PotAnim
@onready var cond_row: HBoxContainer = $Panel/VBox/CondRow
@onready var repeat_row: HBoxContainer = $Panel/VBox/RepeatRow
@onready var timing_row: HBoxContainer = $Panel/VBox/TimingRow
@onready var undo_btn: Button = $Panel/VBox/Tools/UndoBtn
@onready var submit_btn: Button = $Panel/VBox/Tools/SubmitBtn
@onready var back_btn: Button = $Panel/VBox/Tools/BackBtn

func _ready() -> void:
	undo_btn.pressed.connect(_undo)
	submit_btn.pressed.connect(_submit)
	back_btn.pressed.connect(func(): cancelled.emit())
	_fill()

func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("undo_step"):
		_undo()
		get_viewport().set_input_as_handled()

func open_station() -> void:
	visible = true
	condition_id = ""
	repeat_step_id = ""
	timing_choice = ""
	_history.clear()
	prompt.text = "贴标签：问什么、反复做什么、先问还是先做。"
	pot_l.text = "保温壶待命（禁用「循环体」说法）"

func _fill() -> void:
	_btn(cond_row, "循环条件：水温是否够", COND_OK, "cond")
	_btn(cond_row, "循环条件：第几次加热(干扰)", "count_n", "cond")
	_btn(repeat_row, "反复步骤：继续加热／再检测", REPEAT_OK, "repeat")
	_btn(repeat_row, "反复步骤：倒水喝掉(干扰)", "pour", "repeat")
	_btn(timing_row, "先问再做", TIMING_OK, "timing")
	_btn(timing_row, "先做再问", "do_first", "timing")

func _btn(parent: HBoxContainer, text: String, id: String, kind: String) -> void:
	var b := Button.new()
	b.text = text
	b.pressed.connect(_pick.bind(kind, id))
	parent.add_child(b)

func _pick(kind: String, id: String) -> void:
	_history.push_back({"c": condition_id, "r": repeat_step_id, "t": timing_choice})
	match kind:
		"cond":
			condition_id = id
		"repeat":
			repeat_step_id = id
		"timing":
			timing_choice = id
	pot_l.text = "已贴：条件=%s｜反复=%s｜时机=%s" % [condition_id, repeat_step_id, timing_choice]

func _undo() -> void:
	if _history.is_empty():
		return
	var h: Dictionary = _history.pop_back()
	condition_id = str(h.get("c", ""))
	repeat_step_id = str(h.get("r", ""))
	timing_choice = str(h.get("t", ""))
	pot_l.text = "撤回后：条件=%s｜反复=%s｜时机=%s" % [condition_id, repeat_step_id, timing_choice]

func _submit() -> void:
	var ok := condition_id == COND_OK and repeat_step_id == REPEAT_OK and timing_choice == TIMING_OK
	if not ok:
		var n := GameState.bump_fail(GameState.TASK_S2C)
		ClassroomBridge.request_scaffold(GameState.TASK_S2C, mini(n, 3), "M5")
		pot_l.text = "壶空转或一直加热不判停。⌫ 重贴。\n图上先出现问句还是加热？"
		return
	pot_l.text = "壶短循环：加热→检测→再加热…直到条件停 ✓"
	completed.emit({
		"evidenceCode": "E3",
		"attemptKind": "first" if int(GameState.fail_counts.get(GameState.TASK_S2C, 0)) == 0 else "revision",
		"correct": true,
		"payload": {
			"capture": "in_world_action",
			"conditionId": condition_id,
			"repeatStepId": repeat_step_id,
			"timingChoice": timing_choice,
		},
	})
