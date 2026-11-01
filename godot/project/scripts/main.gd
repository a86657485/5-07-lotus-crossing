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
		_play_intro(false)

func _on_session(_data: Dictionary) -> void:
	_refresh_teleports()

func _build_world() -> void:
	world = Node2D.new()
	world.name = "World"
	add_child(world)

	# 天空
	var bg := ColorRect.new()
	bg.color = SKY
	bg.size = Vector2(1280, 720)
	bg.z_index = -20
	world.add_child(bg)

	# 远景浅城廓／山剪影
	var hill := Polygon2D.new()
	hill.color = Color("5B8FB9")
	hill.polygon = PackedVector2Array([
		Vector2(0, 90), Vector2(180, 40), Vector2(360, 70), Vector2(520, 30),
		Vector2(720, 55), Vector2(900, 25), Vector2(1100, 60), Vector2(1280, 35),
		Vector2(1280, 110), Vector2(0, 110)
	])
	hill.z_index = -18
	world.add_child(hill)
	var hill2 := Polygon2D.new()
	hill2.color = Color("6BA3C9")
	hill2.polygon = PackedVector2Array([
		Vector2(0, 100), Vector2(220, 70), Vector2(480, 95), Vector2(760, 60),
		Vector2(1040, 90), Vector2(1280, 70), Vector2(1280, 120), Vector2(0, 120)
	])
	hill2.z_index = -17
	world.add_child(hill2)

	# 沥青主路（十字）
	_road(world, Rect2(0, 140, 1280, 220), ROAD)  # 横
	_road(world, Rect2(480, 120, 320, 520), Color("455066"))  # 纵偏 HUB/S2
	# 路缘
	_road(world, Rect2(0, 136, 1280, 6), CURB)
	_road(world, Rect2(0, 356, 1280, 6), CURB)

	# 分区底板（半透明可读，非纯灰大方块）
	_zone_pad(world, Rect2(24, 150, 420, 200), Color(0.35, 0.45, 0.55, 0.45), "S1 斑马线引导台", Color("38BDF8"))
	_zone_pad(world, Rect2(470, 150, 340, 180), Color(0.28, 0.35, 0.42, 0.5), "HUB·莲花山南门", AMBER)
	_zone_pad(world, Rect2(840, 150, 416, 200), Color(0.22, 0.30, 0.40, 0.5), "S3 信号调度亭", Color("34D399"))
	_zone_pad(world, Rect2(160, 390, 960, 280), Color(0.18, 0.24, 0.32, 0.55), "S2 信号循环拆解台", ORANGE)

	# S1 斑马线
	_zebra(world, Vector2(60, 230), 360, 48, 8)

	# S1 人行灯柱
	_traffic_light(world, Vector2(40, 170), "s1_light")

	# S2 核心大灯柱
	_traffic_light(world, Vector2(560, 430), "s2_light", true)

	# S2 流程图亭底板
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
	# 回边琥珀箭头示意
	var loop_a := Polygon2D.new()
	loop_a.color = Color(AMBER.r, AMBER.g, AMBER.b, 0.85)
	loop_a.polygon = PackedVector2Array([
		Vector2(660, 520), Vector2(780, 520), Vector2(780, 500), Vector2(800, 530),
		Vector2(780, 560), Vector2(780, 540), Vector2(660, 540)
	])
	world.add_child(loop_a)

	# HUB 保温壶桌
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
	else:
		var pot := ColorRect.new()
		pot.name = "Thermos"
		pot.color = Color("94A3B8")
		pot.position = Vector2(618, 210)
		pot.size = Vector2(28, 44)
		world.add_child(pot)

	# S3 调度亭 + 时长屏（可闪红）
	if ResourceLoader.exists("res://assets/sprites/props/dispatch_booth.png"):
		var booth_sp := Sprite2D.new()
		booth_sp.name = "DispatchBooth"
		booth_sp.texture = load("res://assets/sprites/props/dispatch_booth.png")
		booth_sp.centered = false
		booth_sp.position = Vector2(930, 175)
		booth_sp.scale = Vector2(1.6, 1.6)
		booth_sp.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		world.add_child(booth_sp)
	else:
		var booth := ColorRect.new()
		booth.color = Color("334155")
		booth.position = Vector2(920, 180)
		booth.size = Vector2(160, 110)
		world.add_child(booth)
	var screen := ColorRect.new()
	screen.name = "TimingScreen"
	screen.color = Color("0F766E")
	screen.position = Vector2(955, 200)
	screen.size = Vector2(100, 48)
	world.add_child(screen)
	_fx_timing = screen
	var screen_lab := Label.new()
	screen_lab.name = "TimingLabel"
	screen_lab.text = "时长屏"
	screen_lab.position = Vector2(978, 214)
	screen_lab.add_theme_font_size_override("font_size", 14)
	if UiTheme.ui_font:
		screen_lab.add_theme_font_override("font", UiTheme.ui_font)
	world.add_child(screen_lab)
	# 车流条
	for i in range(5):
		var car := ColorRect.new()
		car.color = Color("F87171") if i < 3 else Color("4ADE80")
		car.position = Vector2(900 + i * 36, 310)
		car.size = Vector2(28, 14)
		car.name = "CarFlow_%d" % i
		world.add_child(car)

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
	var path := "res://assets/sprites/props/signal_red.png"
	if ResourceLoader.exists(path):
		var sp := Sprite2D.new()
		sp.name = name
		sp.texture = load(path)
		sp.centered = false
		sp.position = origin
		sp.scale = Vector2(1.35, 1.35) if big else Vector2(1.0, 1.0)
		sp.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		parent.add_child(sp)
		_fx_light_r = sp
		# store state textures on meta for intro flash
		sp.set_meta("tex_red", load("res://assets/sprites/props/signal_red.png"))
		if ResourceLoader.exists("res://assets/sprites/props/signal_amber.png"):
			sp.set_meta("tex_amber", load("res://assets/sprites/props/signal_amber.png"))
		if ResourceLoader.exists("res://assets/sprites/props/signal_green.png"):
			sp.set_meta("tex_green", load("res://assets/sprites/props/signal_green.png"))
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
	replay_btn.pressed.connect(func(): _play_intro(true))
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

	# Dialogue
	dialogue = _make_modal("DialogueBox", Vector2(320, 520), Vector2(640, 160))
	ui.add_child(dialogue)
	dialogue.visible = false

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
	s1 = _load_station("S1", "res://scripts/stations/s1_order.gd", _s1_tree)
	s2a = _load_station("S2A", "res://scripts/stations/s2_rewrite.gd", _s2a_tree)
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
	var vb := VBoxContainer.new()
	vb.name = "VBox"
	panel.add_child(vb)
	_lab(vb, "Prompt", "S1")
	_lab(vb, "PedFeedback", "")
	var pool := HBoxContainer.new(); pool.name = "Pool"; vb.add_child(pool)
	var slots := HBoxContainer.new(); slots.name = "Slots"; vb.add_child(slots)
	var cand := HBoxContainer.new(); cand.name = "Candidates"; vb.add_child(cand)
	vb.add_child(_tools())

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
	var vb := VBoxContainer.new(); vb.name = "VBox"; panel.add_child(vb)
	_lab(vb, "Prompt", "S2-B")
	_lab(vb, "AnimFeedback", "")
	var screens := HBoxContainer.new(); screens.name = "Screens"; vb.add_child(screens)
	var lb := Button.new(); lb.name = "LoopBtn"; lb.text = "左屏·循环（有回边）"; screens.add_child(lb)
	var bb := Button.new(); bb.name = "BranchBtn"; bb.text = "右屏·分支（选路一次）"; screens.add_child(bb)
	var eb := Button.new(); eb.name = "EdgeBtn"; eb.text = "高亮回边"; vb.add_child(eb)
	vb.add_child(_tools())

func _s2c_tree(panel: PanelContainer) -> void:
	var vb := VBoxContainer.new(); vb.name = "VBox"; panel.add_child(vb)
	_lab(vb, "Prompt", "S2-C")
	_lab(vb, "PotAnim", "")
	var r1 := HBoxContainer.new(); r1.name = "CondRow"; vb.add_child(r1)
	var r2 := HBoxContainer.new(); r2.name = "RepeatRow"; vb.add_child(r2)
	var r3 := HBoxContainer.new(); r3.name = "TimingRow"; vb.add_child(r3)
	vb.add_child(_tools())

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
	var closable := is_replay or GameState.intro_seen
	close_b.visible = true
	close_b.text = "× 跳过/关闭"
	body.text = _intro_frames[0]
	for c in close_b.pressed.get_connections():
		close_b.pressed.disconnect(c.callable)
	for c in next_b.pressed.get_connections():
		next_b.pressed.disconnect(c.callable)
	close_b.pressed.connect(func():
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
	if not closable:
		# first play still allow skip per design
		pass
	player.can_move = false

func _on_replay_req(payload: Dictionary) -> void:
	_play_intro(true)

func _show_hub() -> void:
	GameState.active_station = "hub"
	player.can_move = true
	_set_task("阿莲：先去引导台，把队伍排稳。点下方一键前往。")
	GameState.set_focus("teleport_s1")
	_refresh_teleports()
	_hide_stations()

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
	_set_task("①队伍乱了有人要乱穿 ②帮阿莲排地贴 ③排对能按序走并标出一直等")
	# optional learn card short
	s1.visible = true
	if s1.has_method("open_station"):
		s1.open_station()
	_connect_station_once(s1, _on_s1_done, _show_hub)

func _open_s2_flow() -> void:
	# Learn card first
	_hide_stations()
	GameState.active_station = "s2_learn"
	var modal := learn_card
	modal.visible = true
	modal.get_node("VBox/Title").text = "先学卡·信号循环"
	modal.get_node("VBox/Body").text = "阿莲：屏上那截『一直等』，得改成带回箭头的。\n①菱形问「还要不要再做」\n②回边＝条件成立再走一遍\n③次数可以事先不知道\n（不用「循环体」这个词）"
	var close_b: Button = modal.get_node("VBox/HBox/CloseBtn")
	var next_b: Button = modal.get_node("VBox/HBox/NextBtn")
	next_b.text = "开始拆解"
	for c in close_b.pressed.get_connections():
		close_b.pressed.disconnect(c.callable)
	for c in next_b.pressed.get_connections():
		next_b.pressed.disconnect(c.callable)
	close_b.pressed.connect(func(): modal.visible = false)
	next_b.pressed.connect(func():
		modal.visible = false
		_open_s2a()
	)

func _open_s2a() -> void:
	_hide_stations()
	GameState.active_station = "s2a"
	_set_task("①说不清『再等』停哪 ②帮阿莲拆灯态 ③回边接对灯会再闪")
	s2a.visible = true
	if s2a.has_method("open_station"):
		s2a.open_station()
	_connect_station_once(s2a, _on_s2a_done, _show_hub)

func _open_s2b() -> void:
	_hide_stations()
	GameState.active_station = "s2b"
	_set_task("两张屏都有菱形。哪张在问还要不要再做？")
	s2b.visible = true
	if s2b.has_method("open_station"):
		s2b.open_station()
	_connect_station_once(s2b, _on_s2b_done, _show_hub)

func _open_s2c() -> void:
	_hide_stations()
	GameState.active_station = "s2c"
	_set_task("阿莲：休息点的壶也在反复加热，先标清楚。")
	s2c.visible = true
	if s2c.has_method("open_station"):
		s2c.open_station()
	_connect_station_once(s2c, _on_s2c_done, _show_hub)

func _open_s3() -> void:
	_hide_stations()
	GameState.active_station = "s3"
	_set_task("①路口堵了时长错了 ②帮阿莲调时长 ③换规则再运行看是否缓解")
	s3.visible = true
	if s3.has_method("open_station"):
		s3.open_station()
	_connect_station_once(s3, _on_s3_done, _show_hub)

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
	GameState.set_station_done(GameState.TASK_S1, true)
	GameState.unlocked_relics["whistle"] = true
	ClassroomBridge.report_evidence(_envelope(GameState.TASK_S1, data))
	ClassroomBridge.emit_to_js("station:unlock", {"taskId": GameState.TASK_S2A, "unlocked": true})
	_toast("阿莲：顺序有了。下一步把『一直等』说清楚。\n阿莲：这块哨给你，引导台先稳住了。")
	_open_s2_flow()

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
	_toast("阿莲：反复说清了，也分清了『再等』和『选路』。\n阿莲：这枚箭头给你——再等，也能画清楚了。\n阿莲：调度亭那边还在堵。")
	ClassroomBridge.emit_to_js("station:unlock", {"taskId": GameState.TASK_S3, "unlocked": true})
	_show_hub()
	GameState.set_focus("teleport_s3")

func _on_s3_done(data: Dictionary) -> void:
	GameState.set_station_done(GameState.TASK_S3, true)
	GameState.unlocked_relics["knob"] = true
	if data.has("s3Detail") and data["s3Detail"] != null:
		GameState.s3_detail = data["s3Detail"]
	ClassroomBridge.report_evidence(_envelope(GameState.TASK_S3, data))
	ClassroomBridge.emit_to_js("progress:s3Detail", GameState.s3_detail)
	_toast("阿莲：时长设对了，路口顺多了。\n阿莲：三站稳住了。来当课小测。\n领队：顺多了，谢谢小助手。")
	_on_exam_opened()

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
			return "法宝：先填下一个空地贴。步骤要有先后，才能看出哪步在等。"
		"s2a":
			return "法宝：菱形要能答是/否；回边指回还在做的那步。"
		"s2b":
			return "法宝：看哪张有箭头绕回来——那才是『再做』。"
		"s2c":
			return "法宝：先问：不够才加热。别用「循环体」说法。"
		"s3":
			var g = GameState.gate_states.get(GameState.TASK_S3, "pre_missing")
			if g == "pre_missing":
				return "法宝：先点「运行路口」看清故障。"
			return "法宝：已见故障——选时长与理由，再运行核对（勿只重复跑故障）。"
		_:
			return "法宝：按任务单顺序，先去引导台。"

func _reset_current() -> void:
	var map := {"s1": GameState.TASK_S1, "s2a": GameState.TASK_S2A, "s2b": GameState.TASK_S2A, "s2c": GameState.TASK_S2A, "s3": GameState.TASK_S3}
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

func _refresh_teleports() -> void:
	# visual enable/disable by modulate
	if teleport_bar == null:
		return
	# buttons: 0 s1, 1 s2, 2 s3, 3 hub
	if teleport_bar.get_child_count() >= 3:
		teleport_bar.get_child(1).disabled = not GameState.s2_unlocked()
		teleport_bar.get_child(2).disabled = not GameState.s3_unlocked()

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
	var ok := bool(GameState.stations["s1_order"]) and bool(GameState.stations["s2_rewrite"]) and bool(GameState.stations["s2_vs_branch"]) and bool(GameState.stations["s2_kettle"]) and bool(GameState.stations["s3_timing"])
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
