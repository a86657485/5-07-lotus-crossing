extends Control
## 最小课堂嵌入主线：标题 + 三站入口 + 法宝余量 + JS 桥上报

@onready var api: Node = $ClassroomAPI

var _title: Label
var _status: Label
var _relic_label: Label
var _hint: Label
var _hub: VBoxContainer
var _station_panel: PanelContainer
var _station_title: Label
var _station_desc: Label
var _btn_complete: Button
var _btn_back: Button
var _current_station: String = ""

const STATIONS := {
	"s1": {
		"label": "S1 行人过街引导台",
		"desc": "排顺过街步骤，揪出「一直等」。",
	},
	"s2": {
		"label": "S2 信号循环拆解台",
		"desc": "把重复步骤收成循环结构。",
	},
	"s3": {
		"label": "S3 路口信号调度台",
		"desc": "改时长规则并再验证一轮。",
	},
}


func _ready() -> void:
	_build_ui()
	if api:
		api.progress_updated.connect(_on_progress_updated)
		api.station_reported.connect(_on_station_reported)
		api.relic_used.connect(_on_relic_used)
	_refresh_hud()
	_show_hub()


func _build_ui() -> void:
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.color = Color("0f172a")
	bg.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	add_child(bg)

	var root := MarginContainer.new()
	root.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	root.add_theme_constant_override("margin_left", 24)
	root.add_theme_constant_override("margin_right", 24)
	root.add_theme_constant_override("margin_top", 16)
	root.add_theme_constant_override("margin_bottom", 16)
	add_child(root)

	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	root.add_child(col)

	# Top bar
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 12)
	col.add_child(top)

	_title = Label.new()
	_title.text = "莲花山智慧路口"
	_title.add_theme_font_size_override("font_size", 28)
	_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(_title)

	_relic_label = Label.new()
	_relic_label.text = "法宝剩余：3"
	_relic_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	top.add_child(_relic_label)

	var btn_relic := Button.new()
	btn_relic.text = "通关法宝"
	btn_relic.pressed.connect(_on_use_relic_pressed)
	top.add_child(btn_relic)

	_status = Label.new()
	_status.text = "准备就绪"
	_status.add_theme_color_override("font_color", Color("94a3b8"))
	col.add_child(_status)

	_hint = Label.new()
	_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_hint.add_theme_color_override("font_color", Color("fbbf24"))
	_hint.text = ""
	col.add_child(_hint)

	# Hub
	_hub = VBoxContainer.new()
	_hub.add_theme_constant_override("separation", 10)
	col.add_child(_hub)

	var intro := Label.new()
	intro.text = "Godot 试验台（课堂嵌入向）· 主探究仍在 Studio Web 三站"
	intro.add_theme_color_override("font_color", Color("cbd5e1"))
	_hub.add_child(intro)

	for key in ["s1", "s2", "s3"]:
		var station_key: String = str(key)
		var b := Button.new()
		b.text = STATIONS[station_key]["label"]
		b.custom_minimum_size = Vector2(0, 48)
		b.pressed.connect(_make_open_station_cb(station_key))
		_hub.add_child(b)

	# Station panel
	_station_panel = PanelContainer.new()
	_station_panel.visible = false
	col.add_child(_station_panel)

	var sp_margin := MarginContainer.new()
	sp_margin.add_theme_constant_override("margin_left", 16)
	sp_margin.add_theme_constant_override("margin_right", 16)
	sp_margin.add_theme_constant_override("margin_top", 16)
	sp_margin.add_theme_constant_override("margin_bottom", 16)
	_station_panel.add_child(sp_margin)

	var sp_col := VBoxContainer.new()
	sp_col.add_theme_constant_override("separation", 10)
	sp_margin.add_child(sp_col)

	_station_title = Label.new()
	_station_title.add_theme_font_size_override("font_size", 22)
	sp_col.add_child(_station_title)

	_station_desc = Label.new()
	_station_desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sp_col.add_child(_station_desc)

	_btn_complete = Button.new()
	_btn_complete.text = "完成并上报"
	_btn_complete.custom_minimum_size = Vector2(0, 44)
	_btn_complete.pressed.connect(_on_complete_pressed)
	sp_col.add_child(_btn_complete)

	_btn_back = Button.new()
	_btn_back.text = "返回三站入口"
	_btn_back.pressed.connect(_show_hub)
	sp_col.add_child(_btn_back)



func _make_open_station_cb(key: String) -> Callable:
	return func (): _open_station(key)


func _open_station(key: String) -> void:
	_current_station = key
	_hub.visible = false
	_station_panel.visible = true
	_station_title.text = STATIONS[key]["label"]
	_station_desc.text = STATIONS[key]["desc"]
	_hint.text = ""
	_status.text = "站内任务中"


func _show_hub() -> void:
	_current_station = ""
	_hub.visible = true
	_station_panel.visible = false
	_status.text = "三站入口"
	_refresh_hud()


func _on_complete_pressed() -> void:
	if _current_station.is_empty():
		return
	_status.text = "正在上报…"
	_btn_complete.disabled = true
	api.report_station(_current_station, {})


func _on_use_relic_pressed() -> void:
	_hint.text = "正在请求通关法宝…"
	api.use_relic()


func _on_station_reported(task_id: String, ok: bool, message: String) -> void:
	_btn_complete.disabled = false
	if ok:
		_status.text = "上报成功：" + task_id
		_hint.text = message
		_refresh_hud()
		# 回到入口，便于连点三站演示
		_show_hub()
	else:
		_status.text = "上报失败"
		_hint.text = message


func _on_relic_used(ok: bool, hint: String, remaining: int) -> void:
	if ok:
		_hint.text = hint
		if remaining >= 0:
			_relic_label.text = "法宝剩余：%d" % remaining
	else:
		_hint.text = hint
	_refresh_hud()


func _on_progress_updated(progress: Dictionary) -> void:
	_apply_progress_to_hud(progress)


func _refresh_hud() -> void:
	_apply_progress_to_hud(api.get_progress())
	var student: Dictionary = api.get_student()
	var name := str(student.get("name", ""))
	if name.is_empty():
		name = "未登录"
	var mode := "Web桥" if api.has_bridge() else "本地降级"
	_title.text = "莲花山智慧路口 · %s（%s）" % [name, mode]


func _apply_progress_to_hud(progress: Dictionary) -> void:
	var relics: Dictionary = progress.get("relics", {})
	var remaining := int(relics.get("remaining", 3))
	_relic_label.text = "法宝剩余：%d" % remaining
	var st: Dictionary = progress.get("stations", {})
	var marks: PackedStringArray = []
	marks.append("S1✓" if st.get("s1_order", false) else "S1·")
	var s2 = st.get("s2_rewrite", false) and st.get("s2_vs_branch", false) and st.get("s2_kettle", false)
	marks.append("S2✓" if s2 else "S2·")
	marks.append("S3✓" if st.get("s3_timing", false) else "S3·")
	_status.text = "进度 " + " ".join(marks)
