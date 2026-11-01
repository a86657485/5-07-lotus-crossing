extends Control
## ≤25字；×/Esc；1–2句；二刷可立即关

signal closed
signal finished

@onready var panel: PanelContainer = $Panel
@onready var speaker_label: Label = $Panel/VBox/Speaker
@onready var text_label: Label = $Panel/VBox/Text
@onready var close_btn: Button = $Panel/VBox/HBox/CloseBtn
@onready var next_btn: Button = $Panel/VBox/HBox/NextBtn

var _queue: Array = []  # [{speaker, text}]
var _idx: int = 0
var closable_from_start: bool = false
var _seen_once: bool = false

func _ready() -> void:
	visible = false
	close_btn.pressed.connect(_on_close)
	next_btn.pressed.connect(_on_next)

func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("ui_cancel"):
		if closable_from_start or _seen_once or _idx == 0:
			_on_close()
			get_viewport().set_input_as_handled()

func play(lines: Array, p_closable_from_start: bool = false) -> void:
	_queue = lines
	_idx = 0
	closable_from_start = p_closable_from_start
	visible = true
	_show_current()

func _show_current() -> void:
	if _idx >= _queue.size():
		_finish()
		return
	var line: Dictionary = _queue[_idx]
	speaker_label.text = str(line.get("speaker", "阿莲"))
	var t := str(line.get("text", ""))
	if t.length() > 25:
		t = t.substr(0, 25)
	text_label.text = t
	close_btn.visible = closable_from_start or _seen_once or true  # always show ×; first-play skip allowed
	next_btn.text = "下句" if _idx < _queue.size() - 1 else "好的"

func _on_next() -> void:
	_idx += 1
	_show_current()

func _on_close() -> void:
	visible = false
	closed.emit()
	# 跳过只推叙事：不记学习达成
	finished.emit()

func _finish() -> void:
	_seen_once = true
	visible = false
	finished.emit()

func mark_seen() -> void:
	_seen_once = true
