extends Node
## 全局中文字体 Theme（Web 导出嵌入，杜绝方框）

const FONT_PATH := "res://assets/fonts/NotoSansSC-Regular.ttf"
const FONT_FALLBACK := "res://assets/fonts/NotoSansSC-Lesson.ttf"

var ui_font: Font
var app_theme: Theme

func _ready() -> void:
	_build_theme()
	# 尽早挂到根，后续动态创建的 Label/Button 继承
	if app_theme:
		get_tree().root.theme = app_theme

func _build_theme() -> void:
	var path := FONT_PATH
	if not ResourceLoader.exists(path):
		path = FONT_FALLBACK
	if not ResourceLoader.exists(path):
		push_error("Chinese font missing: %s" % path)
		return
	ui_font = load(path) as Font
	if ui_font == null:
		push_error("Failed to load font: %s" % path)
		return
	app_theme = Theme.new()
	app_theme.default_font = ui_font
	app_theme.default_font_size = 18
	for type_name in ["Label", "Button", "LineEdit", "TextEdit", "CheckBox", "OptionButton"]:
		app_theme.set_font("font", type_name, ui_font)
		app_theme.set_font_size("font_size", type_name, 18 if type_name != "Button" else 18)
	app_theme.set_font("normal_font", "RichTextLabel", ui_font)
	app_theme.set_font("bold_font", "RichTextLabel", ui_font)
	app_theme.set_font_size("normal_font_size", "RichTextLabel", 18)
	# 按钮可点区域更大（触控）
	var sep := StyleBoxFlat.new()
	sep.bg_color = Color("334155")
	sep.set_corner_radius_all(8)
	sep.content_margin_left = 12
	sep.content_margin_right = 12
	sep.content_margin_top = 8
	sep.content_margin_bottom = 8
	app_theme.set_stylebox("normal", "Button", sep)
	var hover := sep.duplicate() as StyleBoxFlat
	hover.bg_color = Color("475569")
	app_theme.set_stylebox("hover", "Button", hover)
	var pressed := sep.duplicate() as StyleBoxFlat
	pressed.bg_color = Color("F97316")
	app_theme.set_stylebox("pressed", "Button", pressed)
	app_theme.set_color("font_color", "Button", Color(0.95, 0.97, 1.0))
	app_theme.set_color("font_hover_color", "Button", Color(1, 1, 1))
	app_theme.set_color("font_pressed_color", "Button", Color(1, 1, 1))
	# Panel
	var panel := StyleBoxFlat.new()
	panel.bg_color = Color(0.08, 0.12, 0.2, 0.94)
	panel.set_corner_radius_all(12)
	panel.content_margin_left = 16
	panel.content_margin_right = 16
	panel.content_margin_top = 14
	panel.content_margin_bottom = 14
	panel.border_color = Color("F59E0B")
	panel.border_width_left = 2
	panel.border_width_top = 2
	panel.border_width_right = 2
	panel.border_width_bottom = 2
	app_theme.set_stylebox("panel", "PanelContainer", panel)

func apply_to(control: Control) -> void:
	if app_theme and control:
		control.theme = app_theme
