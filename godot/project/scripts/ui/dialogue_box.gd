extends Control
## ≤25字；×/Esc；1–2句；二刷可立即关；支持 image 插图

signal closed
signal finished
signal visibility_changed_for_move(open: bool)

@onready var root_panel: PanelContainer = $Panel
@onready var illustration: TextureRect = $Panel/VBox/Illustration
@onready var placeholder: ColorRect = $Panel/VBox/IllustrationPlaceholder
@onready var path_hint: Label = $Panel/VBox/IllustrationPlaceholder/PathHint
@onready var speaker_label: Label = $Panel/VBox/Speaker
@onready var text_label: Label = $Panel/VBox/Text
@onready var close_btn: Button = $Panel/VBox/HBox/CloseBtn
@onready var next_btn: Button = $Panel/VBox/HBox/NextBtn

var _queue: Array = []  # [{speaker, text, image?}]
var _idx: int = 0
var closable_from_start: bool = false
var _seen_once: bool = false

func _ready() -> void:
	visible = false
	if close_btn and not close_btn.pressed.is_connected(_on_close):
		close_btn.pressed.connect(_on_close)
	if next_btn and not next_btn.pressed.is_connected(_on_next):
		next_btn.pressed.connect(_on_next)

func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("ui_cancel"):
		# 首看不可 Esc 关；仅 closable_from_start（二刷／回放）或已看完一遍
		if closable_from_start or _seen_once:
			_on_close()
			get_viewport().set_input_as_handled()

func play(lines: Array, p_closable_from_start: bool = false) -> void:
	_queue = lines
	_idx = 0
	closable_from_start = p_closable_from_start
	visible = true
	visibility_changed_for_move.emit(true)
	_show_current()

func _show_current() -> void:
	if _idx >= _queue.size():
		_finish()
		return
	var line: Dictionary = _queue[_idx]
	if speaker_label:
		speaker_label.text = str(line.get("speaker", "阿莲"))
	var t := str(line.get("text", ""))
	if t.length() > 25:
		t = t.substr(0, 25)
	if text_label:
		text_label.text = t
	_apply_image(str(line.get("image", "")))
	if close_btn:
		# 首看隐藏 ×；二刷／已看过才显示（对齐 main.gd modal Closable）
		var can_close := closable_from_start or _seen_once
		close_btn.visible = can_close
		close_btn.disabled = not can_close
		close_btn.text = "×" if can_close else ""
	if next_btn:
		next_btn.text = "下句" if _idx < _queue.size() - 1 else "好的"

func _apply_image(path: String) -> void:
	if illustration == null:
		return
	if path == "":
		illustration.visible = false
		if placeholder:
			placeholder.visible = false
		return
	if ResourceLoader.exists(path):
		var tex = load(path)
		if tex:
			illustration.texture = tex
			illustration.visible = true
			if placeholder:
				placeholder.visible = false
			return
	# 占位：色块 + 路径
	illustration.visible = false
	if placeholder:
		placeholder.visible = true
		placeholder.color = Color(0.25, 0.35, 0.5)
		if path_hint:
			path_hint.text = path

func _on_next() -> void:
	_idx += 1
	_show_current()

func _on_close() -> void:
	# 门禁：首看不可关；仅 closable_from_start 或 _seen_once
	if not (closable_from_start or _seen_once):
		return
	visible = false
	visibility_changed_for_move.emit(false)
	closed.emit()
	finished.emit()

func _finish() -> void:
	_seen_once = true
	visible = false
	visibility_changed_for_move.emit(false)
	finished.emit()

func mark_seen() -> void:
	_seen_once = true
