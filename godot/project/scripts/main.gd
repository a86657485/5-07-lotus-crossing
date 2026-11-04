extends Node
## Main：World 一图三工位 + UI + Bridge 调度

const ChibiFactoryScr = preload("res://scripts/world/chibi_factory.gd")

const ORANGE := Color("F97316")
const AMBER := Color("F59E0B")
const ROAD := Color("4B5563")
const SKY := Color("7EC8FF")
const CURB := Color("9CA3AF")

var player: CharacterBody2D
var alian: Node2D
var focus_ring: Node2D
var dialogue: Control
var task_bar: Control
var relic_hud: Control
var learn_card: Control
var story_replay: Control
var reset_btn: Button
var teleport_bar: HBoxContainer
var station_host: Control
var quest_drawer: Control
var move_lock_reasons: Dictionary = {}
var world: Node2D

var s1: Control
var s2a: Control
var s2b: Control
var s2c: Control
var s3: Control

# 开场世界反馈节点（人流／乱穿／时长闪红）
var _fx_crowd: Node2D
var _fx_jay: Node2D
var _fx_timing: CanvasItem
var _fx_light_r: CanvasItem
var _peds: Array = []
var leader: Node2D

var _intro_frames: Array = [
	"旁白：莲花山南门这边，开放日人特别多。",
	"阿莲：开放日人多，需要助手。",
	"阿莲：先穿上这件橙马甲。",
	"领队：别让孩子们在路口空等太久。",
	"行人：等到绿灯就行。",
	"阿莲：等到什么时候停？说不清。",
	"系统：时长屏参数错乱。",
	"探究：哪一步在反复？做到什么时候停？",
	"探究：灯时长为啥要改？",
	"阿莲：先去引导台，把队伍排稳。",
]

func _ready() -> void:
	# Node 根无 theme 属性；全局字体由 UiTheme 挂到 root.theme
	_build_world()
	_build_ui()
	_build_stations()
	if UiTheme.app_theme:
		UiTheme.apply_to(station_host)
		UiTheme.apply_to(task_bar)
		UiTheme.apply_to(relic_hud)
		UiTheme.apply_to(dialogue)
		UiTheme.apply_to(learn_card)
		UiTheme.apply_to(story_replay)
		if quest_drawer:
			UiTheme.apply_to(quest_drawer)
	ClassroomBridge.session_received.connect(_on_session)
	ClassroomBridge.story_replay_request.connect(_on_replay_req)
	GameState.exam_opened.connect(_on_exam_opened)
	GameState.stations_changed.connect(_refresh_teleports)
	call_deferred("_start_flow")
	if "--smoke" in OS.get_cmdline_user_args() or "--smoke" in OS.get_cmdline_args():
		call_deferred("_smoke_playthrough")
	if "--shot-s1" in OS.get_cmdline_args() or "--shot-s1" in OS.get_cmdline_user_args():
		call_deferred("_shot_s1")
	if "--shot-hub" in OS.get_cmdline_args() or "--shot-hub" in OS.get_cmdline_user_args():
		call_deferred("_shot_hub")


func _start_flow() -> void:
	if GameState.intro_seen:
		_show_hub()
	else:
		_play_intro_illustrated(false)

func _on_session(_data: Dictionary) -> void:
	_refresh_teleports()

func _build_world() -> void:
	world = Node2D.new()
	world.name = "World"
	add_child(world)

	var has_hub_bg := ResourceLoader.exists("res://assets/sprites/ai/scenes/street_hub_bg.png") 		or ResourceLoader.exists("res://assets/sprites/scenes/street_hub_bg.png")
	if has_hub_bg:
		var bg_tex: Texture2D = null
		if ResourceLoader.exists("res://assets/sprites/ai/scenes/street_hub_bg.png"):
			bg_tex = load("res://assets/sprites/ai/scenes/street_hub_bg.png")
		else:
			bg_tex = load("res://assets/sprites/scenes/street_hub_bg.png")
		var bg_sp := Sprite2D.new()
		bg_sp.name = "StreetHubBG"
		bg_sp.texture = bg_tex
		bg_sp.centered = false
		bg_sp.position = Vector2.ZERO
		bg_sp.z_index = -20
		bg_sp.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		world.add_child(bg_sp)
		# 轻量角标（非满屏色块说明条）
		_zone_chip(world, Vector2(36, 156), "S1 引导台", Color("38BDF8"))
		_zone_chip(world, Vector2(520, 156), "HUB", AMBER)
		_zone_chip(world, Vector2(980, 156), "S3 调度亭", Color("34D399"))
		_zone_chip(world, Vector2(200, 400), "S2 拆解台", ORANGE)
	else:
		# 天空 + 色块街景 fallback
		var bg := ColorRect.new()
		bg.color = SKY
		bg.size = Vector2(1280, 720)
		bg.z_index = -20
		world.add_child(bg)
		var hill := Polygon2D.new()
		hill.color = Color("5B8FB9")
		hill.polygon = PackedVector2Array([
			Vector2(0, 90), Vector2(180, 40), Vector2(360, 70), Vector2(520, 30),
			Vector2(720, 55), Vector2(900, 25), Vector2(1100, 60), Vector2(1280, 35),
			Vector2(1280, 110), Vector2(0, 110)
		])
		hill.z_index = -18
		world.add_child(hill)
		_road(world, Rect2(0, 140, 1280, 220), ROAD)
		_road(world, Rect2(480, 120, 320, 520), Color("455066"))
		_zone_pad(world, Rect2(24, 150, 420, 200), Color(0.35, 0.45, 0.55, 0.45), "S1 斑马线引导台", Color("38BDF8"))
		_zone_pad(world, Rect2(470, 150, 340, 180), Color(0.28, 0.35, 0.42, 0.5), "HUB·莲花山南门", AMBER)
		_zone_pad(world, Rect2(840, 150, 416, 200), Color(0.22, 0.30, 0.40, 0.5), "S3 信号调度亭", Color("34D399"))
		_zone_pad(world, Rect2(160, 390, 960, 280), Color(0.18, 0.24, 0.32, 0.55), "S2 信号循环拆解台", ORANGE)
		_zebra(world, Vector2(60, 230), 360, 48, 8)

	# 灯柱：有街景时只留 S2 一柱，减噪；fallback 双柱
	if has_hub_bg:
		_traffic_light(world, Vector2(520, 380), "s2_light", true)
	else:
		_traffic_light(world, Vector2(70, 175), "s1_light")
		_traffic_light(world, Vector2(560, 400), "s2_light", true)

	# AI 街景已含亭／桌时不再叠色块说明板，减噪
	if not has_hub_bg:
		var kiosk := ColorRect.new()
		kiosk.color = Color("1E293B")
		kiosk.position = Vector2(640, 450)
		kiosk.size = Vector2(180, 120)
		world.add_child(kiosk)
		var kiosk_title := Label.new()
		kiosk_title.text = "拆解台"
		kiosk_title.position = Vector2(690, 456)
		kiosk_title.add_theme_font_size_override("font_size", 16)
		if UiTheme.ui_font:
			kiosk_title.add_theme_font_override("font", UiTheme.ui_font)
		world.add_child(kiosk_title)
		var loop_a := Polygon2D.new()
		loop_a.color = Color(AMBER.r, AMBER.g, AMBER.b, 0.85)
		loop_a.polygon = PackedVector2Array([
			Vector2(660, 520), Vector2(780, 520), Vector2(780, 500), Vector2(800, 530),
			Vector2(780, 560), Vector2(780, 540), Vector2(660, 540)
		])
		world.add_child(loop_a)

	# HUB 保温壶桌／调度亭叠层：有 AI 街景则不叠，避免挡玩法
	if not has_hub_bg:
		var table := ColorRect.new()
		table.color = Color("78716C")
		table.position = Vector2(600, 250)
		table.size = Vector2(70, 18)
		world.add_child(table)
		if ResourceLoader.exists("res://assets/sprites/props/thermos.png"):
			var pot_sp := Sprite2D.new()
			pot_sp.name = "Thermos"
			pot_sp.texture = load("res://assets/sprites/props/thermos.png")
			pot_sp.centered = false
			pot_sp.position = Vector2(610, 190)
			pot_sp.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
			world.add_child(pot_sp)
		if ResourceLoader.exists("res://assets/sprites/props/dispatch_booth.png"):
			var booth_sp := Sprite2D.new()
			booth_sp.name = "DispatchBooth"
			booth_sp.texture = load("res://assets/sprites/props/dispatch_booth.png")
			booth_sp.centered = false
			booth_sp.position = Vector2(930, 175)
			booth_sp.scale = Vector2(1.6, 1.6)
			booth_sp.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
			world.add_child(booth_sp)
	# 轻量时长屏反馈条（可闪红；不挡街景主体）
	var screen := ColorRect.new()
	screen.name = "TimingScreen"
	screen.color = Color(0.06, 0.46, 0.43, 0.55)
	screen.position = Vector2(1000, 168)
	screen.size = Vector2(88, 28)
	world.add_child(screen)
	_fx_timing = screen
	var screen_lab := Label.new()
	screen_lab.name = "TimingLabel"
	screen_lab.text = "时长"
	screen_lab.position = Vector2(1020, 170)
	screen_lab.add_theme_font_size_override("font_size", 12)
	if UiTheme.ui_font:
		screen_lab.add_theme_font_override("font", UiTheme.ui_font)
	world.add_child(screen_lab)

	# 行人队列（S1）— 开场人流反馈
	_fx_crowd = Node2D.new()
	_fx_crowd.name = "CrowdFX"
	world.add_child(_fx_crowd)
	_peds.clear()
	for i in range(4):
		var ped := Node2D.new()
		ped.name = "Ped_%d" % i
		ped.position = Vector2(100 + i * 42, 270)
		ChibiFactoryScr.make_pedestrian(ped, [Color("64748B"), Color("94A3B8"), Color("78716C"), Color("57534E")][i])
		_fx_crowd.add_child(ped)
		_peds.append(ped)
	# 乱穿者
	_fx_jay = Node2D.new()
	_fx_jay.name = "Jaywalker"
	_fx_jay.position = Vector2(220, 250)
	ChibiFactoryScr.make_pedestrian(_fx_jay, Color("EF4444"))
	world.add_child(_fx_jay)

	# Player
	player = CharacterBody2D.new()
	player.name = "Player"
	player.position = Vector2(640, 240)
	ChibiFactoryScr.make_player(player)
	player.set_script(load("res://scripts/world/player.gd"))
	world.add_child(player)

	focus_ring = Node2D.new()
	focus_ring.name = "FocusRing"
	focus_ring.set_script(load("res://scripts/world/focus_ring.gd"))
	player.add_child(focus_ring)

	# NPC 阿莲（略高）
	alian = Node2D.new()
	alian.name = "NPC_Alian"
	alian.position = Vector2(720, 230)
	ChibiFactoryScr.make_alian(alian)
	var aname := Label.new()
	aname.text = "阿莲"
	aname.position = Vector2(-16, 18)
	aname.add_theme_font_size_override("font_size", 14)
	if UiTheme.ui_font:
		aname.add_theme_font_override("font", UiTheme.ui_font)
		aname.add_theme_color_override("font_color", Color(1, 0.95, 0.85))
	alian.add_child(aname)
	world.add_child(alian)

	# 领队（HUB 外缘轻量）
	leader = Node2D.new()
	leader.name = "NPC_Leader"
	leader.position = Vector2(540, 200)
	ChibiFactoryScr.make_leader(leader)
	var lname := Label.new()
	lname.text = "领队"
	lname.position = Vector2(-16, 18)
	lname.add_theme_font_size_override("font_size", 14)
	if UiTheme.ui_font:
		lname.add_theme_font_override("font", UiTheme.ui_font)
	leader.add_child(lname)
	world.add_child(leader)

func _road(parent: Node2D, rect: Rect2, color: Color) -> void:
	var tex: Texture2D = null
	if ResourceLoader.exists("res://assets/sprites/tiles/asphalt_tile.png"):
		tex = load("res://assets/sprites/tiles/asphalt_tile.png")
	if tex:
		var tw := 64
		var th := 64
		var x0 := int(rect.position.x)
		var y0 := int(rect.position.y)
		var x1 := int(rect.position.x + rect.size.x)
		var y1 := int(rect.position.y + rect.size.y)
		var y := y0
		while y < y1:
			var x := x0
			while x < x1:
				var sp := Sprite2D.new()
				sp.texture = tex
				sp.centered = false
				sp.position = Vector2(x, y)
				sp.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
				sp.z_index = -15
				parent.add_child(sp)
				x += tw
			y += th
		# curb strip on top edge if horizontal-ish
		if rect.size.x > rect.size.y and ResourceLoader.exists("res://assets/sprites/tiles/curb_tile.png"):
			var ctex: Texture2D = load("res://assets/sprites/tiles/curb_tile.png")
			var cx := x0
			while cx < x1:
				var cs := Sprite2D.new()
				cs.texture = ctex
				cs.centered = false
				cs.position = Vector2(cx, y0 - 8)
				cs.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
				cs.z_index = -14
				parent.add_child(cs)
				cx += 64
	else:
		var r := ColorRect.new()
		r.position = rect.position
		r.size = rect.size
		r.color = color
		r.z_index = -15
		parent.add_child(r)

func _zone_chip(parent: Node2D, pos: Vector2, title: String, accent: Color) -> void:
	var chip := ColorRect.new()
	chip.position = pos
	chip.size = Vector2(118, 26)
	chip.color = Color(0.08, 0.1, 0.14, 0.55)
	chip.z_index = -9
	parent.add_child(chip)
	var bar := ColorRect.new()
	bar.position = pos
	bar.size = Vector2(4, 26)
	bar.color = accent
	bar.z_index = -8
	parent.add_child(bar)
	var lab := Label.new()
	lab.text = title
	lab.position = pos + Vector2(10, 3)
	lab.add_theme_font_size_override("font_size", 14)
	if UiTheme.ui_font:
		lab.add_theme_font_override("font", UiTheme.ui_font)
	lab.add_theme_color_override("font_color", Color(1, 0.96, 0.9))
	lab.z_index = -7
	parent.add_child(lab)

func _zone_pad(parent: Node2D, rect: Rect2, fill: Color, title: String, accent: Color) -> void:
	var r := ColorRect.new()
	r.position = rect.position
	r.size = rect.size
	r.color = fill
	r.z_index = -12
	parent.add_child(r)
	var top := ColorRect.new()
	top.position = rect.position
	top.size = Vector2(rect.size.x, 6)
	top.color = accent
	top.z_index = -11
	parent.add_child(top)
	var lab := Label.new()
	lab.text = title
	lab.position = rect.position + Vector2(10, 10)
	lab.add_theme_font_size_override("font_size", 18)
	if UiTheme.ui_font:
		lab.add_theme_font_override("font", UiTheme.ui_font)
	lab.add_theme_color_override("font_color", Color(1, 0.96, 0.88))
	lab.z_index = -10
	parent.add_child(lab)

func _zebra(parent: Node2D, origin: Vector2, width: float, height: float, stripes: int) -> void:
	if ResourceLoader.exists("res://assets/sprites/tiles/zebra_tile.png"):
		var tex: Texture2D = load("res://assets/sprites/tiles/zebra_tile.png")
		var n := maxi(1, int(width / 64.0))
		for i in range(n):
			var sp := Sprite2D.new()
			sp.texture = tex
			sp.centered = false
			sp.position = origin + Vector2(i * 64, 0)
			sp.scale = Vector2(1.0, maxf(1.0, height / 64.0))
			sp.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
			parent.add_child(sp)
		return
	var bed := ColorRect.new()
	bed.position = origin
	bed.size = Vector2(width, height)
	bed.color = Color("374151")
	parent.add_child(bed)
	var sw := width / float(stripes * 2)
	for i in range(stripes):
		var s := ColorRect.new()
		s.position = origin + Vector2(i * sw * 2, 4)
		s.size = Vector2(sw, height - 8)
		s.color = Color(1, 1, 1, 0.92)
		parent.add_child(s)

func _traffic_light(parent: Node2D, origin: Vector2, name: String, big: bool = false) -> void:
	var prop_paths := [
		"res://assets/sprites/ai/props/signal_prop.png",
		"res://assets/sprites/props/signal_prop.png",
		"res://assets/sprites/props/signal_red.png",
	]
	for path in prop_paths:
		if not ResourceLoader.exists(path):
			continue
		var sp := Sprite2D.new()
		sp.name = name
		sp.texture = load(path)
		sp.centered = false
		sp.position = origin
		var th := float(sp.texture.get_height())
		var target := 160.0 if big else 110.0
		var s := target / maxf(1.0, th)
		sp.scale = Vector2(s, s)
		sp.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		parent.add_child(sp)
		_fx_light_r = sp
		return
	var pole_h := 130 if big else 90
	var pole := ColorRect.new()
	pole.name = name + "_pole"
	pole.color = Color("111827")
	pole.position = origin
	pole.size = Vector2(18 if big else 14, pole_h)
	parent.add_child(pole)
	var box := ColorRect.new()
	box.color = Color("0F172A")
	box.position = origin + Vector2(-8, 0)
	box.size = Vector2(34 if big else 28, 90 if big else 70)
	parent.add_child(box)
	var colors := [Color("EF4444"), Color("F59E0B"), Color("22C55E")]
	for i in range(3):
		var lamp := ColorRect.new()
		lamp.name = "%s_lamp_%d" % [name, i]
		lamp.size = Vector2(20 if big else 16, 20 if big else 16)
		lamp.position = origin + Vector2(-1, 8 + i * (28 if big else 22))
		lamp.color = colors[i]
		parent.add_child(lamp)
		if name == "s2_light" and i == 0:
			_fx_light_r = lamp

func _intro_world_fx(frame_idx: int) -> void:
	# 对齐 02b 开场可见冲突：人流／乱穿／时长闪红
	match frame_idx:
		0, 1, 2:
			# 人流微颤
			if _fx_crowd:
				for i in range(_peds.size()):
					var ped: Node2D = _peds[i]
					var tw := create_tween()
					tw.tween_property(ped, "position:x", ped.position.x + 6, 0.25)
					tw.tween_property(ped, "position:x", ped.position.x, 0.25)
		3, 4:
			# 乱穿抬脚
			if _fx_jay:
				var tw := create_tween()
				tw.tween_property(_fx_jay, "position", Vector2(260, 210), 0.35)
				tw.tween_property(_fx_jay, "modulate", Color(1.2, 0.6, 0.6), 0.2)
		5, 6:
			# 时长屏闪红 + 红灯强调
			if _fx_timing:
				var tw := create_tween().set_loops(3)
				tw.tween_property(_fx_timing, "color", Color("DC2626"), 0.18)
				tw.tween_property(_fx_timing, "color", Color("7F1D1D"), 0.18)
			if _fx_light_r:
				var tw2 := create_tween().set_loops(3)
				tw2.tween_property(_fx_light_r, "modulate", Color(1.4, 0.4, 0.4), 0.15)
				tw2.tween_property(_fx_light_r, "modulate", Color.WHITE, 0.15)
		_:
			if _fx_timing:
				_fx_timing.color = Color("0F766E")

func _build_ui() -> void:
	var ui := CanvasLayer.new()
	ui.name = "UI"
	add_child(ui)

	# Task prompt
	task_bar = PanelContainer.new()
	task_bar.name = "TaskPromptBar"
	task_bar.position = Vector2(200, 8)
	task_bar.size = Vector2(880, 40)
	var tb_l := Label.new()
	tb_l.name = "Label"
	tb_l.text = "莲花山南门智慧路口：开放日临时小交警助手。"
	task_bar.add_child(tb_l)
	ui.add_child(task_bar)

	# Relic HUD
	relic_hud = HBoxContainer.new()
	relic_hud.name = "RelicHUD"
	relic_hud.position = Vector2(1040, 8)
	var count := Label.new()
	count.name = "Count"
	count.text = "法宝 3/3"
	var use_btn := Button.new()
	use_btn.name = "UseBtn"
	use_btn.text = "用法宝"
	relic_hud.add_child(count)
	relic_hud.add_child(use_btn)
	ui.add_child(relic_hud)
	use_btn.pressed.connect(_on_relic)
	GameState.relic_changed.connect(func(): count.text = "法宝 %d/%d" % [GameState.relic_remaining, GameState.relic_quota])

	# Teleport buttons
	teleport_bar = HBoxContainer.new()
	teleport_bar.name = "TeleportButtons"
	teleport_bar.position = Vector2(24, 660)
	ui.add_child(teleport_bar)
	for item in [["前往引导台", "s1", Vector2(200, 220)], ["前往拆解台", "s2", Vector2(640, 480)], ["前往调度台", "s3", Vector2(1000, 220)], ["回枢纽", "hub", Vector2(640, 200)]]:
		var b := Button.new()
		b.text = item[0]
		b.custom_minimum_size = Vector2(160, 48)
		if UiTheme.ui_font:
			b.add_theme_font_override("font", UiTheme.ui_font)
			b.add_theme_font_size_override("font_size", 18)
		b.pressed.connect(_teleport.bind(str(item[1]), item[2]))
		teleport_bar.add_child(b)

	var replay_btn := Button.new()
	replay_btn.text = "剧情回放"
	replay_btn.custom_minimum_size = Vector2(140, 48)
	if UiTheme.ui_font:
		replay_btn.add_theme_font_override("font", UiTheme.ui_font)
		replay_btn.add_theme_font_size_override("font_size", 18)
	replay_btn.pressed.connect(func(): _play_intro_illustrated(true))
	teleport_bar.add_child(replay_btn)

	reset_btn = Button.new()
	reset_btn.name = "StationResetBtn"
	reset_btn.text = "重做本关"
	reset_btn.custom_minimum_size = Vector2(140, 48)
	if UiTheme.ui_font:
		reset_btn.add_theme_font_override("font", UiTheme.ui_font)
		reset_btn.add_theme_font_size_override("font_size", 18)
	reset_btn.pressed.connect(_reset_current)
	teleport_bar.add_child(reset_btn)

	# Dialogue with illustration
	dialogue = _build_dialogue_box()
	ui.add_child(dialogue)
	dialogue.visible = false
	if dialogue.has_signal("visibility_changed_for_move"):
		dialogue.visibility_changed_for_move.connect(func(open: bool): _set_move_lock("dialogue", open))

	# Quest drawer (主线任务／操作帮助)
	quest_drawer = Control.new()
	quest_drawer.name = "QuestDrawer"
	quest_drawer.set_script(load("res://scripts/ui/quest_drawer.gd"))
	ui.add_child(quest_drawer)
	if quest_drawer.has_signal("open_changed"):
		quest_drawer.open_changed.connect(func(open: bool): _set_move_lock("quest", open))

	# Learn card
	learn_card = _make_modal("LearnCard", Vector2(280, 120), Vector2(720, 400))
	ui.add_child(learn_card)
	learn_card.visible = false

	# Story replay uses dialogue-like
	story_replay = _make_modal("StoryReplay", Vector2(300, 180), Vector2(680, 280))
	ui.add_child(story_replay)
	story_replay.visible = false

	# Station host overlay
	station_host = Control.new()
	station_host.name = "StationHost"
	station_host.set_anchors_preset(Control.PRESET_FULL_RECT)
	station_host.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(station_host)

func _make_modal(p_name: String, pos: Vector2, size: Vector2) -> PanelContainer:
	var p := PanelContainer.new()
	p.name = p_name
	p.position = pos
	p.size = size
	var vb := VBoxContainer.new()
	vb.name = "VBox"
	p.add_child(vb)
	var title := Label.new()
	title.name = "Title"
	title.text = p_name
	vb.add_child(title)
	var body := Label.new()
	body.name = "Body"
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.custom_minimum_size = Vector2(size.x - 40, size.y - 100)
	vb.add_child(body)
	var hb := HBoxContainer.new()
	hb.name = "HBox"
	vb.add_child(hb)
	var close_b := Button.new()
	close_b.name = "CloseBtn"
	close_b.text = "× 关闭"
	hb.add_child(close_b)
	var next_b := Button.new()
	next_b.name = "NextBtn"
	next_b.text = "下一步"
	hb.add_child(next_b)
	return p

func _build_stations() -> void:
	s1 = _load_station("S1", "res://scripts/stations/s2_rewrite.gd", _s1_tree)
	s2a = _load_station("S2A", "res://scripts/stations/s2_vs_branch.gd", _s2b_tree)  # 旧入口兼容，实际走 _open_s2b
	s2b = _load_station("S2B", "res://scripts/stations/s2_vs_branch.gd", _s2b_tree)
	s2c = _load_station("S2C", "res://scripts/stations/s2_kettle.gd", _s2c_tree)
	s3 = _load_station("S3", "res://scripts/stations/s3_timing.gd", _s3_tree)
	for st in [s1, s2a, s2b, s2c, s3]:
		st.visible = false
		station_host.add_child(st)

func _load_station(p_name: String, script_path: String, tree_builder: Callable) -> Control:
	var root := Control.new()
	root.name = p_name
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_STOP
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.55)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(dim)
	var panel := PanelContainer.new()
	panel.name = "Panel"
	panel.position = Vector2(80, 60)
	panel.size = Vector2(1120, 560)
	root.add_child(panel)
	tree_builder.call(panel)
	root.set_script(load(script_path))
	if UiTheme.app_theme:
		UiTheme.apply_to(root)
	return root

func _s1_tree(panel: PanelContainer) -> void:
	# 流程图板由 s2_rewrite.gd 在 Panel 内自建；此处只留空壳
	var host := Control.new()
	host.name = "BoardHost"
	host.custom_minimum_size = Vector2(1080, 540)
	panel.add_child(host)

func _s2a_tree(panel: PanelContainer) -> void:
	var vb := VBoxContainer.new(); vb.name = "VBox"; panel.add_child(vb)
	_lab(vb, "Prompt", "S2-A")
	_lab(vb, "LightReplay", "")
	var r1 := HBoxContainer.new(); r1.name = "CondRow"; vb.add_child(r1)
	var r2 := HBoxContainer.new(); r2.name = "RepeatRow"; vb.add_child(r2)
	var r3 := HBoxContainer.new(); r3.name = "BackRow"; vb.add_child(r3)
	var tools := _tools(); tools.get_node("SubmitBtn").name = "LockBtn"; tools.get_node("LockBtn").text = "锁定回放"
	vb.add_child(tools)

func _s2b_tree(panel: PanelContainer) -> void:
	var host := Control.new(); host.name = "BoardHost"; host.custom_minimum_size = Vector2(1080, 540); panel.add_child(host)

func _s2c_tree(panel: PanelContainer) -> void:
	var host := Control.new(); host.name = "BoardHost"; host.custom_minimum_size = Vector2(1080, 540); panel.add_child(host)

func _s3_tree(panel: PanelContainer) -> void:
	var vb := VBoxContainer.new(); vb.name = "VBox"; panel.add_child(vb)
	_lab(vb, "Prompt", "S3")
	_lab(vb, "TrafficBar", "")
	_lab(vb, "GateHint", "")
	var r1 := HBoxContainer.new(); r1.name = "StratRow"; vb.add_child(r1)
	var r2 := HBoxContainer.new(); r2.name = "ReasonRow"; vb.add_child(r2)
	var tools := HBoxContainer.new(); tools.name = "Tools"; vb.add_child(tools)
	var run_b := Button.new(); run_b.name = "RunBtn"; run_b.text = "运行路口"; tools.add_child(run_b)
	var undo_b := Button.new(); undo_b.name = "UndoBtn"; undo_b.text = "⌫ 撤回"; undo_b.visible = false; tools.add_child(undo_b)
	var sub := Button.new(); sub.name = "SubmitBtn"; sub.text = "锁定通关"; tools.add_child(sub)
	var back := Button.new(); back.name = "BackBtn"; back.text = "回地图"; tools.add_child(back)

func _lab(parent: Node, p_name: String, text: String) -> Label:
	var l := Label.new()
	l.name = p_name
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(l)
	return l

func _tools() -> HBoxContainer:
	var tools := HBoxContainer.new()
	tools.name = "Tools"
	var undo_b := Button.new(); undo_b.name = "UndoBtn"; undo_b.text = "⌫ 撤回"; tools.add_child(undo_b)
	var sub := Button.new(); sub.name = "SubmitBtn"; sub.text = "确认"; tools.add_child(sub)
	var back := Button.new(); back.name = "BackBtn"; back.text = "回地图"; tools.add_child(back)
	return tools



func _build_dialogue_box() -> Control:
	var root := Control.new()
	root.name = "DialogueBox"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_STOP
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.35)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(dim)
	var panel := PanelContainer.new()
	panel.name = "Panel"
	panel.position = Vector2(200, 80)
	panel.size = Vector2(880, 520)
	root.add_child(panel)
	var vb := VBoxContainer.new()
	vb.name = "VBox"
	panel.add_child(vb)
	var ill := TextureRect.new()
	ill.name = "Illustration"
	ill.custom_minimum_size = Vector2(840, 280)
	ill.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ill.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	ill.visible = false
	vb.add_child(ill)
	var ph := ColorRect.new()
	ph.name = "IllustrationPlaceholder"
	ph.custom_minimum_size = Vector2(840, 200)
	ph.color = Color(0.25, 0.35, 0.5)
	ph.visible = false
	vb.add_child(ph)
	var ph_l := Label.new()
	ph_l.name = "PathHint"
	ph_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	ph.add_child(ph_l)
	var sp := Label.new()
	sp.name = "Speaker"
	sp.text = "阿莲"
	vb.add_child(sp)
	var tx := Label.new()
	tx.name = "Text"
	tx.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	tx.custom_minimum_size = Vector2(800, 48)
	vb.add_child(tx)
	var hb := HBoxContainer.new()
	hb.name = "HBox"
	vb.add_child(hb)
	var close_b := Button.new()
	close_b.name = "CloseBtn"
	close_b.text = "× 关闭"
	hb.add_child(close_b)
	var next_b := Button.new()
	next_b.name = "NextBtn"
	next_b.text = "下句"
	hb.add_child(next_b)
	root.set_script(load("res://scripts/ui/dialogue_box.gd"))
	return root

func _set_move_lock(reason: String, locked: bool) -> void:
	if locked:
		move_lock_reasons[reason] = true
	else:
		move_lock_reasons.erase(reason)
	if player:
		player.can_move = move_lock_reasons.is_empty()

func _refresh_quest() -> void:
	if quest_drawer and quest_drawer.has_method("refresh_from_state"):
		quest_drawer.refresh_from_state()

func _play_station_dialogue(lines: Array, closable: bool, on_done: Callable) -> void:
	if dialogue == null or not dialogue.has_method("play"):
		on_done.call()
		return
	_set_move_lock("dialogue", true)
	for c in dialogue.finished.get_connections():
		dialogue.finished.disconnect(c.callable)
	for c in dialogue.closed.get_connections():
		dialogue.closed.disconnect(c.callable)
	var done_flag := {"v": false}
	var finish := func():
		if done_flag["v"]:
			return
		done_flag["v"] = true
		_set_move_lock("dialogue", false)
		on_done.call()
	dialogue.finished.connect(finish, CONNECT_ONE_SHOT)
	dialogue.closed.connect(finish, CONNECT_ONE_SHOT)
	dialogue.play(lines, closable)

func _play_intro_illustrated(replay: bool) -> void:
	var lines := [
		{"speaker": "旁白", "text": "莲花山南门开放日，人特别多。", "image": "res://assets/story/cg_intro_crowd.png"},
		{"speaker": "阿莲", "text": "开放日人多，需要助手。", "image": "res://assets/story/cg_intro_crowd.png"},
		{"speaker": "阿莲", "text": "先穿上这件橙马甲。", "image": "res://assets/story/cg_intro_crowd.png"},
		{"speaker": "领队", "text": "别让孩子们在路口空等太久。", "image": "res://assets/story/cg_intro_crowd.png"},
		{"speaker": "阿莲", "text": "等到什么时候停？说不清。", "image": "res://assets/story/cg_intro_crowd.png"},
		{"speaker": "阿莲", "text": "先去引导台，把队伍排稳。", "image": "res://assets/story/cg_intro_crowd.png"},
	]
	_set_move_lock("dialogue", true)
	if dialogue and dialogue.has_method("play"):
		if replay and dialogue.has_method("mark_seen"):
			dialogue.mark_seen()
		for c in dialogue.finished.get_connections():
			dialogue.finished.disconnect(c.callable)
		for c in dialogue.closed.get_connections():
			dialogue.closed.disconnect(c.callable)
		var finish := func():
			GameState.intro_seen = true
			_set_move_lock("dialogue", false)
			if not replay:
				ClassroomBridge.report_evidence({
					"eventType": "evidence_lock",
					"schemaVersion": 1,
					"taskId": "intro",
					"evidenceCode": "E0",
					"attemptKind": "process",
					"correct": true,
					"payload": {"capture": "in_world_action", "waitingStepId": "wait_green"},
				})
			_show_hub()
		dialogue.finished.connect(finish, CONNECT_ONE_SHOT)
		dialogue.closed.connect(finish, CONNECT_ONE_SHOT)
		dialogue.play(lines, replay or GameState.intro_seen)
	else:
		_play_intro(replay)

func _play_intro(is_replay: bool) -> void:
	GameState.active_station = "intro"
	var modal := story_replay
	modal.visible = true
	var body: Label = modal.get_node("VBox/Body")
	var close_b: Button = modal.get_node("VBox/HBox/CloseBtn")
	var next_b: Button = modal.get_node("VBox/HBox/NextBtn")
	var title: Label = modal.get_node("VBox/Title")
	title.text = "开场委托" if not is_replay else "剧情回放（可随时关）"
	var idx := [0]
	# 首看不可跳过；二刷／已看过可关
	var closable := is_replay or GameState.intro_seen
	close_b.visible = closable
	close_b.disabled = not closable
	close_b.text = "× 关闭" if closable else ""
	body.text = _intro_frames[0]
	for c in close_b.pressed.get_connections():
		close_b.pressed.disconnect(c.callable)
	for c in next_b.pressed.get_connections():
		next_b.pressed.disconnect(c.callable)
	close_b.pressed.connect(func():
		if not (is_replay or GameState.intro_seen):
			return
		modal.visible = false
		GameState.intro_seen = true
		ClassroomBridge.emit_to_js("story:replay", {"fromFrame": 1, "closable": true, "closed": true})
		_show_hub()
	)
	next_b.pressed.connect(func():
		idx[0] += 1
		if idx[0] >= _intro_frames.size():
			modal.visible = false
			GameState.intro_seen = true
			# E0 micro: mark waiting step awareness (not mastery)
			ClassroomBridge.report_evidence({
				"eventType": "evidence_lock",
				"schemaVersion": 1,
				"taskId": "intro",
				"evidenceCode": "E0",
				"attemptKind": "process",
				"correct": true,
				"payload": {"capture": "in_world_action", "waitingStepId": "wait_green"},
			})
			_intro_world_fx(idx[0] - 1)
			_show_hub()
		else:
			body.text = _intro_frames[idx[0]]
			_intro_world_fx(idx[0])
	)
	# 首帧也给一点人流反馈
	_intro_world_fx(0)
	player.can_move = false

func _on_replay_req(payload: Dictionary) -> void:
	_play_intro_illustrated(true)

func _show_hub() -> void:
	GameState.active_station = "hub"
	_set_move_lock("station", false)
	_set_move_lock("dialogue", false)
	_set_move_lock("learn", false)
	player.can_move = move_lock_reasons.is_empty()
	var next_id := _next_focus_id()
	_set_task(_next_task_line(next_id))
	GameState.set_focus(next_id)
	_refresh_teleports()
	_hide_stations()
	_refresh_quest()

func _hide_stations() -> void:
	for st in [s1, s2a, s2b, s2c, s3]:
		st.visible = false

func _teleport(station: String, pos: Vector2) -> void:
	# ≤0.5s 一键前往
	var tw := create_tween()
	tw.tween_property(player, "global_position", pos, 0.35)
	await tw.finished
	match station:
		"s1":
			if not GameState.s1_unlocked():
				_toast("先听完委托。")
				return
			_open_s1()
		"s2":
			if not GameState.s2_unlocked():
				_toast("阿莲：先把引导台队伍排稳。")
				return
			_open_s2_flow()
		"s3":
			if not GameState.s3_unlocked():
				_toast("阿莲：调度亭那边还在堵——先拆清『再等』。")
				return
			_open_s3()
		"hub":
			_show_hub()

func _open_s1() -> void:
	_hide_stations()
	GameState.active_station = "s1"
	_set_move_lock("station", true)
	_set_task("阿莲：把『一直等』画成带回箭头的图。")
	_play_station_dialogue([
		{"speaker": "阿莲", "text": "开放日队伍乱了，有人要乱穿。", "image": "res://assets/story/cg_s1_queue.png"},
		{"speaker": "阿莲", "text": "帮我把『一直等』画成带回箭头的图。", "image": "res://assets/story/cg_s1_queue.png"},
	], false, func():
		s1.visible = true
		if s1.has_method("open_station"):
			s1.open_station()
		_connect_station_once(s1, _on_s1_done, _show_hub)
		_refresh_quest()
	)

func _open_s2_flow() -> void:
	# E1 已在 S1；本站只做 E2+E3。先学卡 → S2-B 对比 → S2-C 壶
	_hide_stations()
	GameState.active_station = "s2_learn"
	_set_move_lock("station", true)
	var modal := learn_card
	modal.visible = true
	_set_move_lock("learn", true)
	modal.get_node("VBox/Title").text = "先学卡·信号循环"
	modal.get_node("VBox/Body").text = "阿莲：屏上那截『再等』，要分清循环和选路。\n①菱形问「还要不要再做」＝循环条件\n②回边＝条件成立再走一遍反复步骤\n③先问再做；次数可以事先不知道"
	var close_b: Button = modal.get_node("VBox/HBox/CloseBtn")
	var next_b: Button = modal.get_node("VBox/HBox/NextBtn")
	next_b.text = "开始拆解"
	for c in close_b.pressed.get_connections():
		close_b.pressed.disconnect(c.callable)
	for c in next_b.pressed.get_connections():
		next_b.pressed.disconnect(c.callable)
	close_b.pressed.connect(func():
		modal.visible = false
		_set_move_lock("learn", false)
	)
	next_b.pressed.connect(func():
		modal.visible = false
		_set_move_lock("learn", false)
		_play_station_dialogue([
			{"speaker": "阿莲", "text": "信号屏说不清『再等』停在哪。", "image": "res://assets/story/cg_s2_panel.png"},
			{"speaker": "阿莲", "text": "帮我分清再等还是选路。", "image": "res://assets/story/cg_s2_panel.png"},
		], false, func(): _open_s2b())
	)
	_refresh_quest()

func _open_s2a() -> void:
	# E1 已迁到 S1；旧 S2-A 入口改为直接进对比屏
	_open_s2b()

func _open_s2b() -> void:
	_hide_stations()
	GameState.active_station = "s2b"
	_set_move_lock("station", true)
	_set_task("两张屏都有菱形。哪张在问还要不要再做？")
	s2b.visible = true
	if s2b.has_method("open_station"):
		s2b.open_station()
	_connect_station_once(s2b, _on_s2b_done, _show_hub)
	_refresh_quest()

func _open_s2c() -> void:
	_hide_stations()
	GameState.active_station = "s2c"
	_set_move_lock("station", true)
	_set_task("阿莲：休息点的壶也在反复加热，先标清楚。")
	s2c.visible = true
	if s2c.has_method("open_station"):
		s2c.open_station()
	_connect_station_once(s2c, _on_s2c_done, _show_hub)
	_refresh_quest()

func _open_s3() -> void:
	_hide_stations()
	GameState.active_station = "s3"
	_set_move_lock("station", true)
	_set_task("阿莲：先运行看堵，再换时长后重跑。")
	_play_station_dialogue([
		{"speaker": "阿莲", "text": "路口堵了，时长好像设错了。", "image": "res://assets/story/cg_s3_booth.png"},
		{"speaker": "阿莲", "text": "先运行看堵，再改时长核对。", "image": "res://assets/story/cg_s3_booth.png"},
	], false, func():
		s3.visible = true
		if s3.has_method("open_station"):
			s3.open_station()
		_connect_station_once(s3, _on_s3_done, _show_hub)
		_refresh_quest()
	)

func _connect_station_once(st: Control, on_done: Callable, on_cancel: Callable) -> void:
	if st.has_signal("completed"):
		for c in st.completed.get_connections():
			st.completed.disconnect(c.callable)
		st.completed.connect(on_done, CONNECT_ONE_SHOT)
	if st.has_signal("cancelled"):
		for c in st.cancelled.get_connections():
			st.cancelled.disconnect(c.callable)
		st.cancelled.connect(on_cancel, CONNECT_ONE_SHOT)

func _envelope(task_id: String, data: Dictionary) -> Dictionary:
	return {
		"eventType": "evidence_lock",
		"schemaVersion": 1,
		"studentId": GameState.student_id,
		"classId": GameState.class_id,
		"runId": GameState.run_id,
		"taskId": task_id,
		"evidenceCode": data.get("evidenceCode", ""),
		"attemptKind": data.get("attemptKind", "first"),
		"correct": data.get("correct", true),
		"payload": data.get("payload", {}),
		"clientTs": Time.get_datetime_string_from_system(false, true),
		"dedupeKey": "%s|%s|%s" % [GameState.student_id, task_id, str(Time.get_unix_time_from_system())],
		"isTest": GameState.is_test,
		"s3Detail": data.get("s3Detail", null),
	}

func _on_s1_done(data: Dictionary) -> void:
	# 主证据 E1 → taskId s2_rewrite；s1_order 仅可选附属不过问
	GameState.set_station_done(GameState.TASK_S2A, true)
	GameState.set_station_done(GameState.TASK_S1, true)
	GameState.unlocked_relics["whistle"] = true
	var payload = data.duplicate(true)
	if not payload.has("evidenceCode"):
		payload["evidenceCode"] = "E1"
	ClassroomBridge.report_evidence(_envelope(GameState.TASK_S2A, payload))
	ClassroomBridge.emit_to_js("station:unlock", {"taskId": GameState.TASK_S2B, "unlocked": true})
	_play_station_dialogue([
		{"speaker": "阿莲", "text": "接对了，行人按序走。", "image": "res://assets/story/cg_s1_flow_ok.png"},
		{"speaker": "阿莲", "text": "这块哨给你，引导台稳住了。", "image": "res://assets/story/cg_s1_flow_ok.png"},
	], true, func():
		_set_move_lock("station", false)
		_open_s2_flow()
	)

func _on_s2a_done(data: Dictionary) -> void:
	GameState.set_station_done(GameState.TASK_S2A, true)
	ClassroomBridge.report_evidence(_envelope(GameState.TASK_S2A, data))
	_toast("阿莲：接对了，灯会再闪一轮。")
	_open_s2b()

func _on_s2b_done(data: Dictionary) -> void:
	GameState.set_station_done(GameState.TASK_S2B, true)
	ClassroomBridge.report_evidence(_envelope(GameState.TASK_S2B, data))
	_toast("阿莲：选路各走一次；循环是再做一遍。")
	_open_s2c()

func _on_s2c_done(data: Dictionary) -> void:
	GameState.set_station_done(GameState.TASK_S2C, true)
	GameState.unlocked_relics["arrow"] = true
	ClassroomBridge.report_evidence(_envelope(GameState.TASK_S2C, data))
	ClassroomBridge.emit_to_js("station:unlock", {"taskId": GameState.TASK_S3, "unlocked": true})
	_set_move_lock("station", false)
	_toast("阿莲：反复说清了，也分清了『再等』和『选路』。\n阿莲：这枚箭头给你。调度亭那边还在堵。")
	_show_hub()
	GameState.set_focus("teleport_s3")
	_refresh_quest()

func _on_s3_done(data: Dictionary) -> void:
	GameState.set_station_done(GameState.TASK_S3, true)
	GameState.unlocked_relics["knob"] = true
	if data.has("s3Detail") and data["s3Detail"] != null:
		GameState.s3_detail = data["s3Detail"]
	ClassroomBridge.report_evidence(_envelope(GameState.TASK_S3, data))
	ClassroomBridge.emit_to_js("progress:s3Detail", GameState.s3_detail)
	_set_move_lock("station", false)
	_play_station_dialogue([
		{"speaker": "阿莲", "text": "时长设对了，路口顺多了。", "image": "res://assets/story/cg_exam_ready.png"},
		{"speaker": "阿莲", "text": "三站稳住了。可以去考核了。", "image": "res://assets/story/cg_exam_ready.png"},
	], true, func():
		_on_exam_opened()
		_refresh_quest()
	)

func _on_exam_opened() -> void:
	ClassroomBridge.open_exam()
	_set_task("系统：三站完成，开始当课小测。（考核在网页侧）")

func _on_relic() -> void:
	if GameState.relic_remaining <= 0:
		_toast("法宝已用完。")
		return
	# 指路不代做
	var tip := _relic_tip()
	_toast(tip)
	if OS.has_feature("web"):
		ClassroomBridge.use_relic()
	else:
		GameState.consume_relic_local()

func _relic_tip() -> String:
	match GameState.active_station:
		"s1":
			if s1 and s1.has_method("highlight_for_relic"):
				return "法宝：" + s1.highlight_for_relic()
			return "法宝：把一直等改成：问还要不要再观察。点『是』拉回观察框。"
		"s2a":
			return "法宝：看哪张有箭头绕回来——那才是『再做』。"
		"s2b":
			if s2b and s2b.has_method("highlight_for_relic"):
				return "法宝：" + s2b.highlight_for_relic()
			return "法宝：看哪张有箭头绕回来——那才是『再做』。"
		"s2c":
			return "法宝：先问够不够：不够才加热，再检测——先问先做。"
		"s3":
			var g = GameState.gate_states.get(GameState.TASK_S3, "pre_missing")
			if g == "pre_missing":
				return "法宝：先点「运行路口」看清故障。"
			return "法宝：已见故障——选时长与理由，再运行核对（勿只重复跑故障）。"
		_:
			return "法宝：按任务单顺序，先去引导台。"

func _reset_current() -> void:
	var map := {"s1": GameState.TASK_S2A, "s2a": GameState.TASK_S2B, "s2b": GameState.TASK_S2B, "s2c": GameState.TASK_S2C, "s3": GameState.TASK_S3}
	var tid: String = map.get(GameState.active_station, "")
	if tid == "":
		_toast("当前不在关卡内。")
		return
	GameState.reset_station(tid)
	ClassroomBridge.emit_to_js("station:reset", {"taskId": tid})
	match GameState.active_station:
		"s1": _open_s1()
		"s2a": _open_s2a()
		"s2b": _open_s2b()
		"s2c": _open_s2c()
		"s3": _open_s3()

func _next_focus_id() -> String:
	if not GameState.intro_seen:
		return "teleport_s1"
	if not bool(GameState.stations.get(GameState.TASK_S2A, false)):
		return "teleport_s1"
	var s2_done := bool(GameState.stations.get(GameState.TASK_S2A, false)) 		and bool(GameState.stations.get(GameState.TASK_S2B, false)) 		and bool(GameState.stations.get(GameState.TASK_S2C, false))
	if not s2_done:
		return "teleport_s2"
	if not bool(GameState.stations.get(GameState.TASK_S3, false)):
		return "teleport_s3"
	return "exam"

func _next_task_line(focus_id: String) -> String:
	match focus_id:
		"teleport_s1":
			return "阿莲：先去引导台，把『一直等』画成带回箭头的图。"
		"teleport_s2":
			return "阿莲：前往拆解台，分清『再等』和『选路』。"
		"teleport_s3":
			return "阿莲：调度亭还在堵，去调时长。"
		"exam":
			return "系统：三站稳住了，开始当课小测。"
		_:
			return "听阿莲安排，一站站帮上忙。"

func _refresh_teleports() -> void:
	# 唯一「下一步」琥珀高亮；未解锁禁用；其余弱化
	if teleport_bar == null:
		return
	if teleport_bar.get_child_count() < 3:
		return
	(teleport_bar.get_child(1) as Button).disabled = not GameState.s2_unlocked()
	(teleport_bar.get_child(2) as Button).disabled = not GameState.s3_unlocked()
	var focus: String = _next_focus_id()
	for i in mini(4, teleport_bar.get_child_count()):
		var b: Button = teleport_bar.get_child(i)
		b.modulate = Color(0.75, 0.78, 0.82, 1.0)
	var idx: int = -1
	match focus:
		"teleport_s1":
			idx = 0
		"teleport_s2":
			idx = 1
		"teleport_s3":
			idx = 2
	if idx >= 0:
		var nb: Button = teleport_bar.get_child(idx)
		nb.modulate = Color(1.15, 0.95, 0.55, 1.0)
		nb.disabled = false

func _set_task(t: String) -> void:
	if task_bar and task_bar.get_child_count() > 0:
		task_bar.get_child(0).text = t

func _toast(msg: String) -> void:
	_set_task(msg)
	print("[G5L7] ", msg)


func _smoke_playthrough() -> void:
	await get_tree().process_frame
	await get_tree().create_timer(0.2).timeout
	if story_replay and story_replay.visible:
		story_replay.visible = false
	GameState.intro_seen = true
	_show_hub()
	await get_tree().process_frame
	_open_s1()
	await get_tree().process_frame
	for id in ["arrive", "wait_green", "green_go", "cross_alert", "arrive_other"]:
		s1._on_pool_pick(id)
	s1._submit()
	await get_tree().process_frame
	s1._on_pick_waiting("wait_green")
	s1._submit()
	await get_tree().process_frame
	if learn_card and learn_card.visible:
		learn_card.get_node("VBox/HBox/NextBtn").pressed.emit()
		await get_tree().process_frame
	if s2a.visible:
		s2a._pick("cond", "cond_not_green", "")
		s2a._pick("repeat", "repeat_observe", "")
		s2a._pick("back", "back_to_repeat", "")
		s2a._lock()
		await get_tree().process_frame
	if s2b.visible:
		s2b._select("loop")
		s2b._submit()
		await get_tree().process_frame
	if s2c.visible:
		s2c._pick("cond", "water_low")
		s2c._pick("repeat", "keep_heat")
		s2c._pick("timing", "ask_first")
		s2c._submit()
		await get_tree().process_frame
	_open_s3()
	await get_tree().process_frame
	if s3.visible:
		s3._run()
		s3._pick("strat", "extend_green_car")
		s3._pick("reason", "serve_junction")
		s3._run()
		s3._submit()
		await get_tree().process_frame
	var ok := bool(GameState.stations["s2_rewrite"]) and bool(GameState.stations["s2_vs_branch"]) and bool(GameState.stations["s2_kettle"]) and bool(GameState.stations["s3_timing"])
	print("[smoke] FINAL=", GameState.stations, " ok=", ok, " font=", UiTheme.ui_font != null)
	get_tree().quit(0 if ok else 1)


func _shot_hub() -> void:
	await get_tree().create_timer(0.25).timeout
	if story_replay:
		story_replay.visible = false
	GameState.intro_seen = true
	_show_hub()
	# 可见冲突：时长闪红 + 乱穿位
	_intro_world_fx(6)
	if _fx_jay:
		_fx_jay.position = Vector2(250, 205)

func _shot_s1() -> void:

	await get_tree().create_timer(0.3).timeout
	if story_replay:
		story_replay.visible = false
	GameState.intro_seen = true
	_show_hub()
	await get_tree().process_frame
	_open_s1()
