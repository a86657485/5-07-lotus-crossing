extends Control
## 先学卡；可重看可关（×/Esc）

signal closed
signal start_explore

@onready var title_l: Label = $Panel/VBox/Title
@onready var body_l: RichTextLabel = $Panel/VBox/Body
@onready var close_btn: Button = $Panel/VBox/HBox/CloseBtn
@onready var start_btn: Button = $Panel/VBox/HBox/StartBtn

func _ready() -> void:
	visible = false
	close_btn.pressed.connect(_close)
	start_btn.pressed.connect(_start)

func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed("ui_cancel"):
		_close()
		get_viewport().set_input_as_handled()

func open_card(title: String, body_bbcode: String, start_text: String = "开始拆解") -> void:
	title_l.text = title
	body_l.text = body_bbcode
	start_btn.text = start_text
	visible = true

func _close() -> void:
	visible = false
	closed.emit()

func _start() -> void:
	visible = false
	start_explore.emit()
