extends Control
## 剧情回放：二刷首帧可关

signal closed
signal finished_all

var _frames: Array = []
var _i: int = 0
var closable: bool = true

@onready var text_l: Label = $Panel/VBox/Text
@onready var close_btn: Button = $Panel/VBox/HBox/CloseBtn
@onready var next_btn: Button = $Panel/VBox/HBox/NextBtn

func _ready() -> void:
	visible = false
	close_btn.pressed.connect(_close)
	next_btn.pressed.connect(_next)

func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("ui_cancel") and closable:
		_close()
		get_viewport().set_input_as_handled()

func play(frames: Array, from_frame: int = 1, p_closable: bool = true) -> void:
	_frames = frames
	_i = maxi(0, from_frame - 1)
	closable = p_closable
	close_btn.visible = closable
	visible = true
	_show()

func _show() -> void:
	if _i >= _frames.size():
		visible = false
		finished_all.emit()
		return
	text_l.text = str(_frames[_i])

func _next() -> void:
	_i += 1
	_show()

func _close() -> void:
	visible = false
	closed.emit()
