extends Control
## S2-A 信号屏：拖菱形/矩形/回边 → 灯态回放

signal completed(payload: Dictionary)
signal cancelled

const COND_OK := "cond_not_green"
const REPEAT_OK := "repeat_observe"
const BACK_OK := "back_to_repeat"

var cond_id: String = ""
var repeat_id: String = ""
var back_id: String = ""
var locked: bool = false
var _history: Array = []

@onready var prompt: Label = $Panel/VBox/Prompt
@onready var light_l: Label = $Panel/VBox/LightReplay
@onready var cond_box: HBoxContainer = $Panel/VBox/CondRow
@onready var repeat_box: HBoxContainer = $Panel/VBox/RepeatRow
@onready var back_box: HBoxContainer = $Panel/VBox/BackRow
@onready var undo_btn: Button = $Panel/VBox/Tools/UndoBtn
@onready var lock_btn: Button = $Panel/VBox/Tools/LockBtn
@onready var back_btn: Button = $Panel/VBox/Tools/BackBtn

func _ready() -> void:
	undo_btn.pressed.connect(_undo)
	lock_btn.pressed.connect(_lock)
	back_btn.pressed.connect(func(): cancelled.emit())
	_fill_choices()

func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("undo_step"):
		_undo()
		get_viewport().set_input_as_handled()

func open_station() -> void:
	visible = true
	cond_id = ""
	repeat_id = ""
	back_id = ""
	locked = false
	_history.clear()
	light_l.text = "灯柱待命（锁定后回放）"
	_refresh_labels()

func _fill_choices() -> void:
	_add_choice(cond_box, "菱形：绿灯未亮？", COND_OK, "cond")
	_add_choice(cond_box, "菱形：走天桥？(干扰)", "cond_bridge", "cond")
	_add_choice(cond_box, "菱形：过马路(误放动作)", "cond_action", "cond")
	_add_choice(repeat_box, "矩形：原地观察红绿灯", REPEAT_OK, "repeat")
	_add_choice(repeat_box, "矩形：整段过街(干扰)", "repeat_all", "repeat")
	_add_choice(back_box, "回边→反复观察", BACK_OK, "back")
	_add_choice(back_box, "回边→过马路(干扰)", "back_cross", "back")
	_add_choice(back_box, "回边反接(干扰)", "back_rev", "back")

func _add_choice(parent: HBoxContainer, text: String, id: String, kind: String) -> void:
	var b := Button.new()
	b.text = text
	b.pressed.connect(_pick.bind(kind, id, text))
	parent.add_child(b)

func _pick(kind: String, id: String, _text: String) -> void:
	if locked:
		return
	_history.push_back({"kind": kind, "prev_cond": cond_id, "prev_repeat": repeat_id, "prev_back": back_id})
	match kind:
		"cond":
			cond_id = id
		"repeat":
			repeat_id = id
		"back":
			back_id = id
	_refresh_labels()

func _undo() -> void:
	if locked or _history.is_empty():
		if locked:
			locked = false
			light_l.text = "已解锁修改，改后请重锁。"
		return
	var h: Dictionary = _history.pop_back()
	cond_id = str(h.get("prev_cond", ""))
	repeat_id = str(h.get("prev_repeat", ""))
	back_id = str(h.get("prev_back", ""))
	_refresh_labels()

func _refresh_labels() -> void:
	prompt.text = "阿莲：屏上那截『一直等』，得改成带回箭头的。\n把『观察并等待』改成带回箭头的图。"
	# selection shown in light line pre-lock
	if not locked:
		light_l.text = "条件=%s｜反复=%s｜回边=%s（锁定前不对错）" % [cond_id, repeat_id, back_id]

func _lock() -> void:
	if cond_id == "" or repeat_id == "" or back_id == "":
		light_l.text = "请先选齐菱形、矩形、回边。"
		return
	locked = true
	var ok := cond_id == COND_OK and repeat_id == REPEAT_OK and back_id == BACK_OK
	if ok:
		light_l.text = "灯态回放：未亮→再观察闪烁一轮→亮了→走出循环过街 ✓"
		var payload := {
			"evidenceCode": "E1",
			"attemptKind": "first" if int(GameState.fail_counts.get(GameState.TASK_S2A, 0)) == 0 else "revision",
			"correct": true,
			"payload": {
				"capture": "in_world_action",
				"conditionCardId": cond_id,
				"repeatCardId": repeat_id,
				"backEdgeTo": back_id,
				"lightReplay": "loop_then_exit",
			},
		}
		completed.emit(payload)
	else:
		var n := GameState.bump_fail(GameState.TASK_S2A)
		ClassroomBridge.request_scaffold(GameState.TASK_S2A, mini(n, 3), "M3")
		light_l.text = "回放卡住／行人误走。⌫ 可改后重锁。\n" + _hint(n)
		locked = false

func _hint(n: int) -> String:
	match n:
		1:
			return "菱形里要能答是或否。"
		2:
			return "箭头该指回还在做的那步吗？"
		_:
			return "对照同结构示意图（换地名），不圈本题槽。"
