extends Control
## S1 可选过程附属（s1_order）：点出「一直等」对应处理框
## 非主交互；禁止空位1–5；主证据在 s2_rewrite／E1

signal completed(payload: Dictionary)
signal cancelled

var _picked: String = ""
var prompt: Label
var feedback: Label
var row: HBoxContainer
var undo_btn: Button
var submit_btn: Button
var back_btn: Button
var _history: Array = []

const OBSERVE := "observe"

func _ready() -> void:
	_ensure_ui()

func _ensure_ui() -> void:
	if prompt != null:
		return
	var panel := get_node_or_null("Panel") as PanelContainer
	if panel == null:
		panel = PanelContainer.new()
		panel.name = "Panel"
		panel.position = Vector2(200, 160)
		panel.size = Vector2(880, 320)
		add_child(panel)
	for c in panel.get_children():
		c.queue_free()
	var vb := VBoxContainer.new()
	panel.add_child(vb)
	prompt = Label.new()
	prompt.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	prompt.text = "附属：点出『一直等』对应的那一步（可选，不替代主流程图）。"
	vb.add_child(prompt)
	feedback = Label.new()
	vb.add_child(feedback)
	row = HBoxContainer.new()
	vb.add_child(row)
	for item in [["observe", "原地观察红绿灯"], ["cross", "过马路"], ["arrive", "到达对面"]]:
		var b := Button.new()
		b.text = item[1]
		b.pressed.connect(_pick.bind(item[0]))
		row.add_child(b)
	var tools := HBoxContainer.new()
	vb.add_child(tools)
	undo_btn = Button.new()
	undo_btn.text = "⌫ 撤回"
	undo_btn.pressed.connect(_undo)
	tools.add_child(undo_btn)
	submit_btn = Button.new()
	submit_btn.text = "记录过程"
	submit_btn.pressed.connect(_submit)
	tools.add_child(submit_btn)
	back_btn = Button.new()
	back_btn.text = "跳过"
	back_btn.pressed.connect(func(): cancelled.emit())
	tools.add_child(back_btn)

func open_station() -> void:
	visible = true
	_ensure_ui()
	_picked = ""
	_history.clear()
	feedback.text = "点选处理框即可（非空位排序）。"

func _pick(id: String) -> void:
	_history.push_back(_picked)
	_picked = id
	feedback.text = "已点：「%s」" % id

func _undo() -> void:
	if _history.is_empty():
		_picked = ""
	else:
		_picked = str(_history.pop_back())
	feedback.text = "撤回后：「%s」" % _picked

func _submit() -> void:
	if _picked != OBSERVE:
		feedback.text = "阿莲：一直等的是还在观察的那步。"
		return
	completed.emit({
		"evidenceCode": "S1_PROCESS",
		"attemptKind": "process",
		"correct": true,
		"payload": {"capture": "in_world_action", "waitingStepId": "observe"},
	})
