extends Control
## 角落「主线任务」「操作帮助」抽屉（08 §5／对标 6-08）

signal open_changed(open: bool)

var quest_btn: Button
var help_btn: Button
var panel: PanelContainer
var title_l: Label
var body_l: RichTextLabel
var close_btn: Button
var _mode: String = ""

var _quest_title: String = "主线任务"
var _quest_body: String = "听阿莲安排，一站站帮上忙。"
var _help_body: String = """【操作帮助】
· 移动：虚拟摇杆或方向键；靠近高亮再单击交互
· 流程图：从卡片池单击填入空槽；菱形要选能答「是／否」的句子
· 回边：点菱形旁「是」，再点要重复的那一步
· 撤回：键盘 ⌫ 或屏上撤回钮；不扣分；改完记得重新锁定
· 法宝：整课 3 次；只指路、讲为什么，不会替你填答案
· 面板打开时不能走路；关掉或完成后再走
· 二刷剧情：对白窗可随时 ×／Esc 关掉"""

func _ready() -> void:
	_build()
	visible = true
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func _build() -> void:
	if quest_btn != null:
		return
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var btn_box := VBoxContainer.new()
	btn_box.position = Vector2(16, 56)
	btn_box.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(btn_box)
	quest_btn = Button.new()
	quest_btn.text = "主线任务"
	quest_btn.custom_minimum_size = Vector2(120, 40)
	quest_btn.pressed.connect(func(): toggle("quest"))
	btn_box.add_child(quest_btn)
	help_btn = Button.new()
	help_btn.text = "操作帮助"
	help_btn.custom_minimum_size = Vector2(120, 40)
	help_btn.pressed.connect(func(): toggle("help"))
	btn_box.add_child(help_btn)
	panel = PanelContainer.new()
	panel.position = Vector2(16, 150)
	panel.size = Vector2(380, 400)
	panel.visible = false
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(panel)
	var vb := VBoxContainer.new()
	panel.add_child(vb)
	var top := HBoxContainer.new()
	vb.add_child(top)
	title_l = Label.new()
	title_l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(title_l)
	close_btn = Button.new()
	close_btn.text = "×"
	close_btn.pressed.connect(close_drawer)
	top.add_child(close_btn)
	body_l = RichTextLabel.new()
	body_l.bbcode_enabled = true
	body_l.fit_content = true
	body_l.custom_minimum_size = Vector2(340, 320)
	body_l.scroll_active = true
	vb.add_child(body_l)

func toggle(mode: String) -> void:
	if _mode == mode and panel.visible:
		close_drawer()
		return
	_mode = mode
	panel.visible = true
	if mode == "quest":
		title_l.text = _quest_title
		body_l.text = _quest_body
	else:
		title_l.text = "操作帮助"
		body_l.text = _help_body
	open_changed.emit(true)

func close_drawer() -> void:
	_mode = ""
	if panel:
		panel.visible = false
	open_changed.emit(false)

func is_open() -> bool:
	return panel != null and panel.visible

func set_quest(title: String, body: String) -> void:
	_quest_title = title
	_quest_body = body
	if _mode == "quest" and panel and panel.visible:
		title_l.text = title
		body_l.text = body

func refresh_from_state() -> void:
	var station := str(GameState.active_station)
	var title := "主线任务"
	var goal := ""
	var next_step := ""
	var cur := ""
	match station:
		"s1", "s1_flow":
			cur = "S1 引导台"
			goal = "把菱形条件放进空槽，并从「是」拉回观察框"
			next_step = "底栏卡片 → 菱形槽；再点「是」拉线"
		"s2_learn", "s2a", "s2b":
			cur = "S2 拆解台"
			goal = "点出哪张图在问「还要不要再做」，并标出绕回的箭头"
			next_step = "点左／右意图屏 → 高亮回边"
		"s2c":
			cur = "S2 拆解台·保温壶"
			goal = "给保温壶补条件、反复步骤和先问／先做"
			next_step = "壶旁流程图卡片池"
		"s3":
			cur = "S3 调度台"
			goal = "先运行故障 → 选时长与理由 → 再运行核对"
			next_step = "先点「运行路口」"
		"exam":
			cur = "考核"
			goal = "三站稳住了，完成当课小测"
			next_step = "进入考核页"
		_:
			cur = "枢纽"
			if not bool(GameState.stations.get(GameState.TASK_S2A, false)):
				goal = "去引导台，把「一直等」画成带回箭头的图"
				next_step = "点「前往引导台」或靠近斑马线装置"
			elif not (bool(GameState.stations.get(GameState.TASK_S2B, false)) and bool(GameState.stations.get(GameState.TASK_S2C, false))):
				goal = "去拆解台，分清「再等」和「选路」"
				next_step = "点「前往拆解台」"
			elif not bool(GameState.stations.get(GameState.TASK_S3, false)):
				goal = "去调度台，先运行看堵，再改时长"
				next_step = "点「前往调度台」"
			else:
				goal = "三站稳住了，完成当课小测"
				next_step = "进入考核页"
	var s2a := "✓" if bool(GameState.stations.get(GameState.TASK_S2A, false)) else "□"
	var s2b := "✓" if bool(GameState.stations.get(GameState.TASK_S2B, false)) else "□"
	var s2c := "✓" if bool(GameState.stations.get(GameState.TASK_S2C, false)) else "□"
	var s3 := "✓" if bool(GameState.stations.get(GameState.TASK_S3, false)) else "□"
	var wh := "✓" if bool(GameState.unlocked_relics.get("whistle", false)) else "□"
	var ar := "✓" if bool(GameState.unlocked_relics.get("arrow", false)) else "□"
	var kn := "✓" if bool(GameState.unlocked_relics.get("knob", false)) else "□"
	var body := "当前站：%s\n一句话目标：%s\n进度勾选：\n  %s S1 循环图（E1）\n  %s S2 对比（E2）\n  %s S2 保温壶（E3）\n  %s S3 时长（E4）\n下一步：%s\n已收集：%s斑马线哨 %s回边箭头 %s时长旋钮" % [
		cur, goal, s2a, s2b, s2c, s3, next_step, wh, ar, kn
	]
	set_quest(title, body)
