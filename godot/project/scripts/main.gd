extends Node
## Main：World 一图三工位 + UI + Bridge 调度

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

var _intro_frames: Array = [
	"阿莲：开放日人多，需要助手。",
	"阿莲：先穿上这件橙马甲。",
	"行人：等到绿灯就行。——哪一步在一直等？",
	"困难：等到什么时候停？说不清。时长屏参数错乱。",
	"探究：哪一步在反复？做到什么时候停？灯时长为啥要改？",
	"任务单：S1→S2→S3。前往行人过街引导台。",
]

func _ready() -> void:
	_build_world()
	_build_ui()
	_build_stations()
	ClassroomBridge.session_received.connect(_on_session)
	ClassroomBridge.story_replay_request.connect(_on_replay_req)
	GameState.exam_opened.connect(_on_exam_opened)
	GameState.stations_changed.connect(_refresh_teleports)
	call_deferred("_start_flow")

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

	var bg := ColorRect.new()
	bg.color = SKY
	bg.size = Vector2(1280, 720)
	bg.z_index = -10
	world.add_child(bg)

	# zones: S1 left, HUB center, S3 right, S2 bottom
	_zone(world, Rect2(40, 80, 360, 280), Color("64748B"), "S1 引导台")
	_zone(world, Rect2(460, 60, 360, 260), Color("475569"), "HUB 枢纽")
	_zone(world, Rect2(880, 80, 360, 280), Color("334155"), "S3 调度台")
	_zone(world, Rect2(200, 380, 880, 260), Color("1E293B"), "S2 信号循环拆解台")

	# zebra placeholder
	var zebra := ColorRect.new()
	zebra.color = Color(1, 1, 1, 0.85)
	zebra.position = Vector2(80, 200)
	zebra.size = Vector2(280, 24)
	world.add_child(zebra)

	# traffic light placeholder
	var light := ColorRect.new()
	light.color = Color("111827")
	light.position = Vector2(560, 420)
	light.size = Vector2(40, 120)
	world.add_child(light)
	for i in range(3):
		var lamp := ColorRect.new()
		lamp.size = Vector2(24, 24)
		lamp.position = Vector2(568, 432 + i * 36)
		lamp.color = [Color("EF4444"), Color("F59E0B"), Color("22C55E")][i]
		world.add_child(lamp)

	# thermos
	var pot := ColorRect.new()
	pot.color = Color("94A3B8")
	pot.position = Vector2(620, 200)
	pot.size = Vector2(36, 56)
	world.add_child(pot)

	# Player
	player = CharacterBody2D.new()
	player.name = "Player"
	player.position = Vector2(640, 200)
	var body := ColorRect.new()
	body.name = "Body"
	body.size = Vector2(28, 36)
	body.position = Vector2(-14, -20)
	body.color = Color("E0F2FE")
	player.add_child(body)
	var vest := ColorRect.new()
	vest.name = "Vest"
	vest.size = Vector2(32, 22)
	vest.position = Vector2(-16, -8)
	vest.color = ORANGE
	player.add_child(vest)
	var head := ColorRect.new()
	head.name = "Head"
	head.size = Vector2(26, 26)
	head.position = Vector2(-13, -44)
	head.color = Color("FDE68A")
	player.add_child(head)
	player.set_script(load("res://scripts/world/player.gd"))
	world.add_child(player)

	focus_ring = Node2D.new()
	focus_ring.name = "FocusRing"
	var ell := Polygon2D.new()
	ell.name = "Ellipse"
	ell.polygon = PackedVector2Array([Vector2(-28, -10), Vector2(28, -10), Vector2(28, 10), Vector2(-28, 10)])
	ell.color = Color(AMBER.r, AMBER.g, AMBER.b, 0.45)
	focus_ring.add_child(ell)
	var arrow := Polygon2D.new()
	arrow.name = "Arrow"
	arrow.polygon = PackedVector2Array([Vector2(32, -6), Vector2(48, 0), Vector2(32, 6)])
	arrow.color = Color(AMBER.r, AMBER.g, AMBER.b, 0.9)
	focus_ring.add_child(arrow)
	focus_ring.set_script(load("res://scripts/world/focus_ring.gd"))
	player.add_child(focus_ring)

	# NPC Alian
	alian = Node2D.new()
	alian.name = "NPC_Alian"
	alian.position = Vector2(700, 180)
	var ab := ColorRect.new()
	ab.size = Vector2(30, 48)
	ab.position = Vector2(-15, -40)
	ab.color = ORANGE
	alian.add_child(ab)
	var aname := Label.new()
	aname.text = "阿莲"
	aname.position = Vector2(-16, 12)
	aname.add_theme_font_size_override("font_size", 14)
	alian.add_child(aname)
	world.add_child(alian)

func _zone(parent: Node2D, rect: Rect2, color: Color, title: String) -> void:
	var r := ColorRect.new()
	r.position = rect.position
	r.size = rect.size
	r.color = color
	parent.add_child(r)
	var border := ColorRect.new()
	border.position = rect.position
	border.size = Vector2(rect.size.x, 4)
	border.color = CURB
	parent.add_child(border)
	var lab := Label.new()
	lab.text = title
	lab.position = rect.position + Vector2(12, 8)
	lab.add_theme_font_size_override("font_size", 18)
	parent.add_child(lab)

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
	tb_l.text = "开放日路口：听阿莲安排，一站站帮上忙。"
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
		b.custom_minimum_size = Vector2(140, 40)
		b.pressed.connect(_teleport.bind(str(item[1]), item[2]))
		teleport_bar.add_child(b)

	var replay_btn := Button.new()
	replay_btn.text = "剧情回放"
	replay_btn.pressed.connect(func(): _play_intro(true))
	teleport_bar.add_child(replay_btn)

	reset_btn = Button.new()
	reset_btn.name = "StationResetBtn"
	reset_btn.text = "重做本关"
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
			_show_hub()
		else:
			body.text = _intro_frames[idx[0]]
	)
	if not closable:
		# first play still allow skip per design
		pass
	player.can_move = false

func _on_replay_req(payload: Dictionary) -> void:
	_play_intro(true)

func _show_hub() -> void:
	GameState.active_station = "hub"
	player.can_move = true
	_set_task("任务单：完成 S1→S2→S3 后开考。点下方一键前往。")
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
				_toast("请先完成引导台（S1）。")
				return
			_open_s2_flow()
		"s3":
			if not GameState.s3_unlocked():
				_toast("请先完成拆解台三关（S2）。")
				return
			_open_s3()
		"hub":
			_show_hub()

func _open_s1() -> void:
	_hide_stations()
	GameState.active_station = "s1"
	_set_task("S1：把过街步骤排对，并标出一直等的那步。")
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
	modal.get_node("VBox/Body").text = "①菱形问「还要不要再做」\n②回边＝条件成立再走一遍\n③次数可以事先不知道\n（不用「循环体」这个词）"
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
	_set_task("S2-A：把观察并等待改成带回箭头的图。")
	s2a.visible = true
	if s2a.has_method("open_station"):
		s2a.open_station()
	_connect_station_once(s2a, _on_s2a_done, _show_hub)

func _open_s2b() -> void:
	_hide_stations()
	GameState.active_station = "s2b"
	_set_task("S2-B：哪张屏在问还要不要再做？")
	s2b.visible = true
	if s2b.has_method("open_station"):
		s2b.open_station()
	_connect_station_once(s2b, _on_s2b_done, _show_hub)

func _open_s2c() -> void:
	_hide_stations()
	GameState.active_station = "s2c"
	_set_task("S2-C：保温壶贴标签——问什么、反复做什么、先问或先做。")
	s2c.visible = true
	if s2c.has_method("open_station"):
		s2c.open_station()
	_connect_station_once(s2c, _on_s2c_done, _show_hub)

func _open_s3() -> void:
	_hide_stations()
	GameState.active_station = "s3"
	_set_task("S3：先运行见故障，再改时长与理由，再运行核对。")
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
	_toast("阿莲：顺序有了。下一步把『一直等』说清楚。")
	_open_s2_flow()

func _on_s2a_done(data: Dictionary) -> void:
	GameState.set_station_done(GameState.TASK_S2A, true)
	ClassroomBridge.report_evidence(_envelope(GameState.TASK_S2A, data))
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
	_toast("阿莲：反复说清了，也分清了『再等』和『选路』。")
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
	_toast("阿莲：时长设对了，路口顺多了。三站完成，开始当课小测。")
	_on_exam_opened()

func _on_exam_opened() -> void:
	ClassroomBridge.open_exam()
	_set_task("三站完成，开始当课小测。（考核在网页侧）")

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
