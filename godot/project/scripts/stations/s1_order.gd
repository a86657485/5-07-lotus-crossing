extends Control
## S1 步骤地贴拖拽排序 + 点「观察并等待」；错序可见后果；⌫撤回

signal completed(payload: Dictionary)
signal cancelled

const CORRECT_ORDER := ["arrive", "wait_green", "green_go", "cross_alert", "arrive_other"]
const WAIT_ID := "wait_green"

var _slots: Array[String] = ["", "", "", "", ""]
var _history: Array = []
var _waiting_picked: String = ""
var _ped_state: String = "idle"  # idle|ok|chaos
var _phase: int = 1  # 1 sort, 2 pick waiting

@onready var prompt: Label = $Panel/VBox/Prompt
@onready var pool: HBoxContainer = $Panel/VBox/Pool
@onready var slots_row: HBoxContainer = $Panel/VBox/Slots
@onready var ped_label: Label = $Panel/VBox/PedFeedback
@onready var undo_btn: Button = $Panel/VBox/Tools/UndoBtn
@onready var submit_btn: Button = $Panel/VBox/Tools/SubmitBtn
@onready var back_btn: Button = $Panel/VBox/Tools/BackBtn
@onready var candidates: HBoxContainer = $Panel/VBox/Candidates

var STEP_META := {
	"arrive": "到达路口",
	"wait_green": "观察并等待绿灯",
	"green_go": "绿灯亮起可过",
	"cross_alert": "过马路保持警觉",
	"arrive_other": "到达对面",
	"rush": "先冲过马路",
}

func _ready() -> void:
	undo_btn.pressed.connect(_undo)
	submit_btn.pressed.connect(_submit)
	back_btn.pressed.connect(func(): cancelled.emit())
	_build_ui()
	_refresh()

func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("undo_step"):
		_undo()
		get_viewport().set_input_as_handled()

func open_station() -> void:
	visible = true
	_slots = ["", "", "", "", ""]
	_history.clear()
	_waiting_picked = ""
	_phase = 1
	_ped_state = "idle"
	_rebuild_pool()
	_refresh()

func _build_ui() -> void:
	for c in slots_row.get_children():
		c.queue_free()
	for i in range(5):
		var b := Button.new()
		b.custom_minimum_size = Vector2(140, 48)
		b.text = "空位%d" % (i + 1)
		b.pressed.connect(_on_slot_pressed.bind(i))
		slots_row.add_child(b)
	_rebuild_pool()
	_rebuild_candidates()

func _rebuild_pool() -> void:
	for c in pool.get_children():
		c.queue_free()
	var used := {}
	for s in _slots:
		if s != "":
			used[s] = true
	for id in STEP_META.keys():
		if used.has(id):
			continue
		var b := Button.new()
		b.text = STEP_META[id]
		b.custom_minimum_size = Vector2(120, 40)
		# 未作答选项零高亮：普通按钮
		b.pressed.connect(_on_pool_pick.bind(id))
		pool.add_child(b)

func _rebuild_candidates() -> void:
	for c in candidates.get_children():
		c.queue_free()
	candidates.visible = _phase == 2
	if _phase != 2:
		return
	for id in CORRECT_ORDER:
		var b := Button.new()
		b.text = STEP_META[id]
		b.pressed.connect(_on_pick_waiting.bind(id))
		candidates.add_child(b)

func _on_pool_pick(id: String) -> void:
	if _phase != 1:
		return
	var idx := _slots.find("")
	if idx < 0:
		return
	_history.push_back({"op": "place", "idx": idx, "id": id, "prev": ""})
	_slots[idx] = id
	_update_ped()
	_rebuild_pool()
	_refresh()

func _on_slot_pressed(idx: int) -> void:
	if _phase != 1:
		return
	if _slots[idx] == "":
		return
	_history.push_back({"op": "clear", "idx": idx, "id": _slots[idx]})
	_slots[idx] = ""
	_update_ped()
	_rebuild_pool()
	_refresh()

func _on_pick_waiting(id: String) -> void:
	_waiting_picked = id
	_refresh()

func _undo() -> void:
	if _history.is_empty():
		return
	var h: Dictionary = _history.pop_back()
	if h.get("op") == "place":
		_slots[int(h["idx"])] = ""
	elif h.get("op") == "clear":
		_slots[int(h["idx"])] = str(h["id"])
	_update_ped()
	_rebuild_pool()
	_refresh()

func _update_ped() -> void:
	var filled := true
	for s in _slots:
		if s == "":
			filled = false
			break
	if not filled:
		_ped_state = "idle"
		return
	if _slots == CORRECT_ORDER:
		_ped_state = "ok"
	else:
		_ped_state = "chaos"

func _refresh() -> void:
	if _phase == 1:
		prompt.text = "把过街步骤拖到斑马线地贴上（点选填入）"
	else:
		prompt.text = "点出会一直等的那一步"
	for i in range(slots_row.get_child_count()):
		var b: Button = slots_row.get_child(i)
		var id := _slots[i] if i < _slots.size() else ""
		b.text = STEP_META.get(id, "空位%d" % (i + 1)) if id != "" else "空位%d" % (i + 1)
	match _ped_state:
		"ok":
			ped_label.text = "行人按序走过斑马线 ✓"
			ped_label.modulate = Color(0.4, 0.9, 0.5)
		"chaos":
			ped_label.text = "行人卡住／有人乱穿！⌫ 可撤回"
			ped_label.modulate = Color(1.0, 0.4, 0.4)
		_:
			ped_label.text = "行人在路口等待布置…"
			ped_label.modulate = Color(1, 1, 1)
	_rebuild_candidates()
	if _phase == 2 and _waiting_picked != "":
		ped_label.text = "已标：「%s」——等到……？说不清。" % STEP_META.get(_waiting_picked, "")
	submit_btn.text = "确认顺序" if _phase == 1 else "锁定通关"

func _submit() -> void:
	if _phase == 1:
		_update_ped()
		if _ped_state != "ok":
			var n := GameState.bump_fail(GameState.TASK_S1)
			ClassroomBridge.request_scaffold(GameState.TASK_S1, mini(n, 3), "M2")
			ped_label.text = _hint_text(n)
			ped_label.modulate = Color(1.0, 0.6, 0.2)
			return
		_phase = 2
		_refresh()
		return
	# phase 2
	if _waiting_picked != WAIT_ID:
		var n2 := GameState.bump_fail(GameState.TASK_S1)
		ClassroomBridge.request_scaffold(GameState.TASK_S1, mini(n2, 3), "M2")
		ped_label.text = "还没标出一直等的那步。"
		return
	var payload := {
		"evidenceCode": "S1",
		"attemptKind": "first" if int(GameState.fail_counts.get(GameState.TASK_S1, 0)) == 0 else "revision",
		"correct": true,
		"payload": {
			"capture": "in_world_action",
			"stepsOrder": CORRECT_ORDER.duplicate(),
			"waitingStepId": WAIT_ID,
		},
	}
	completed.emit(payload)

func _hint_text(n: int) -> String:
	match n:
		1:
			return "看看行人卡在哪一步。"
		2:
			return "到达对面还要再做吗？"
		_:
			return "对照：五步应按序，干扰「先冲」不能入槽。"
