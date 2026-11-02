extends RefCounted
## 优先 AI 生图；缺文件回退色块。大图自动缩到约 96px 高。

const ORANGE := Color("F97316")
const STRIPE := Color("FDE68A")
const SKIN := Color("FDE68A")
const SHIRT := Color("E0F2FE")
const SHORTS := Color("374151")
const HAIR := Color("1F2937")
const BOOT := Color("111827")
const LEADER_NAVY := Color("1E3A5F")
const HELMET := Color("FBBF24")
const TARGET_H := 96.0

static func try_tex(paths: Array) -> Texture2D:
	for path in paths:
		if ResourceLoader.exists(path):
			return load(path) as Texture2D
	return null

static func _fit_scale(tex: Texture2D, target_h: float = TARGET_H) -> float:
	var h := float(tex.get_height())
	if h <= 1.0:
		return 1.0
	return target_h / h

static func _sprite(parent: Node2D, tex: Texture2D, y: float, target_h: float) -> Sprite2D:
	var sp := Sprite2D.new()
	sp.name = "Sprite"
	sp.texture = tex
	sp.centered = true
	sp.position = Vector2(0, y)
	var s := _fit_scale(tex, target_h)
	sp.scale = Vector2(s, s)
	sp.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	parent.add_child(sp)
	return sp

static func make_player(parent: Node2D) -> void:
	var tex := try_tex([
		"res://assets/sprites/ai/characters/player_down.png",
		"res://assets/sprites/player/idle_down.png",
		"res://assets/sprites/characters/player_down.png",
	])
	if tex:
		_sprite(parent, tex, -8, 100.0)
		return
	_build_chibi(parent, {"taller": false, "vest": ORANGE, "shirt": SHIRT, "pants": SHORTS, "hair": HAIR, "helmet": false, "tablet": false})

static func make_alian(parent: Node2D) -> void:
	var tex := try_tex([
		"res://assets/sprites/ai/characters/alian_front.png",
		"res://assets/sprites/alian/idle_down.png",
		"res://assets/sprites/characters/alian_down.png",
	])
	if tex:
		_sprite(parent, tex, -12, 118.0)
		return
	_build_chibi(parent, {"taller": true, "vest": ORANGE, "shirt": Color("F8FAFC"), "pants": Color("1F2937"), "hair": Color("292524"), "helmet": false, "tablet": true})

static func make_leader(parent: Node2D) -> void:
	var tex := try_tex([
		"res://assets/sprites/leader/idle_down.png",
		"res://assets/sprites/characters/captain_down.png",
	])
	if tex:
		_sprite(parent, tex, -10, 110.0)
		return
	_build_chibi(parent, {"taller": true, "vest": ORANGE, "shirt": LEADER_NAVY, "pants": Color("1F2937"), "hair": HAIR, "helmet": true, "tablet": false})

static func make_pedestrian(parent: Node2D, tone: Color = Color("64748B")) -> void:
	var body := ColorRect.new()
	body.name = "Body"
	body.size = Vector2(14, 22)
	body.position = Vector2(-7, -18)
	body.color = tone
	parent.add_child(body)
	var head := ColorRect.new()
	head.name = "Head"
	head.size = Vector2(16, 16)
	head.position = Vector2(-8, -34)
	head.color = Color(tone.lightened(0.25))
	parent.add_child(head)

static func _rect(parent: Node, name: String, pos: Vector2, size: Vector2, color: Color, z: int = 0) -> ColorRect:
	var r := ColorRect.new()
	r.name = name
	r.position = pos
	r.size = size
	r.color = color
	r.z_index = z
	parent.add_child(r)
	return r

static func _build_chibi(parent: Node2D, cfg: Dictionary) -> void:
	var taller: bool = cfg.get("taller", false)
	var y_off := -6 if taller else 0
	_rect(parent, "ShoeL", Vector2(-12, 10 + y_off), Vector2(10, 6), BOOT, 1)
	_rect(parent, "ShoeR", Vector2(2, 10 + y_off), Vector2(10, 6), Color("F8FAFC"), 1)
	_rect(parent, "Pants", Vector2(-10, -2 + y_off), Vector2(20, 14), cfg["pants"], 1)
	_rect(parent, "Shirt", Vector2(-12, -22 + y_off), Vector2(24, 22), cfg["shirt"], 1)
	_rect(parent, "Vest", Vector2(-14, -20 + y_off), Vector2(28, 18), cfg["vest"], 2)
	_rect(parent, "Stripe1", Vector2(-12, -16 + y_off), Vector2(24, 3), STRIPE, 3)
	_rect(parent, "Stripe2", Vector2(-12, -10 + y_off), Vector2(24, 3), STRIPE, 3)
	_rect(parent, "ArmL", Vector2(-18, -18 + y_off), Vector2(6, 14), cfg["shirt"], 1)
	_rect(parent, "ArmR", Vector2(12, -18 + y_off), Vector2(6, 14), cfg["shirt"], 1)
	_rect(parent, "Head", Vector2(-14, -48 + y_off), Vector2(28, 28), SKIN, 2)
	_rect(parent, "Hair", Vector2(-14, -52 + y_off), Vector2(28, 10), cfg["hair"], 3)
	_rect(parent, "EyeL", Vector2(-8, -38 + y_off), Vector2(5, 6), Color("111827"), 4)
	_rect(parent, "EyeR", Vector2(3, -38 + y_off), Vector2(5, 6), Color("111827"), 4)
	if cfg.get("helmet", false):
		_rect(parent, "Helmet", Vector2(-16, -56 + y_off), Vector2(32, 12), HELMET, 5)
	if cfg.get("tablet", false):
		_rect(parent, "Tablet", Vector2(14, -16 + y_off), Vector2(10, 14), Color("0EA5E9"), 4)
