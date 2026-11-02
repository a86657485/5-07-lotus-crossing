extends Node2D
## 脚底 FocusRing：优先 AI 生图；禁挡脸黄圈

var _sprite: Sprite2D
var _t: float = 0.0

func _ready() -> void:
	position = Vector2(0, 22)
	z_index = -1
	_sprite = Sprite2D.new()
	_sprite.name = "RingSprite"
	_sprite.centered = true
	_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	add_child(_sprite)
	var tex: Texture2D = null
	for p in [
		"res://assets/sprites/ai/fx/focus_ring.png",
		"res://assets/sprites/fx/focus_ring.png",
	]:
		if ResourceLoader.exists(p):
			tex = load(p)
			break
	if tex:
		_sprite.texture = tex
		var target_w := 96.0
		var s := target_w / float(maxi(1, tex.get_width()))
		_sprite.scale = Vector2(s, s)
	else:
		_sprite.visible = false
		var ell := Polygon2D.new()
		ell.polygon = _ellipse_pts(30, 12, 28)
		ell.color = Color(0.961, 0.620, 0.043, 0.42)
		add_child(ell)
		var arrow := Polygon2D.new()
		arrow.polygon = PackedVector2Array([Vector2(34, -7), Vector2(50, 0), Vector2(34, 7)])
		arrow.color = Color(0.961, 0.620, 0.043, 0.9)
		add_child(arrow)

func _process(delta: float) -> void:
	_t += delta
	var s := 1.0 + 0.08 * sin(_t * 4.2)
	scale = Vector2(s, s * 0.9)

static func _ellipse_pts(rx: float, ry: float, n: int) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in n:
		var a := TAU * float(i) / float(n)
		pts.append(Vector2(cos(a) * rx, sin(a) * ry))
	return pts
