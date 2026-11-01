extends Node2D
## 脚底 FocusRing 精灵／pulse；禁挡脸黄圈

var _sprite: Sprite2D
var _t: float = 0.0
var _frames: Array = []
var _fi: int = 0
var _accum: float = 0.0

func _ready() -> void:
	position = Vector2(0, 18)
	z_index = -1
	_sprite = Sprite2D.new()
	_sprite.name = "RingSprite"
	_sprite.centered = true
	_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	add_child(_sprite)
	for p in [
		"res://assets/sprites/fx/focus_ring_pulse_0.png",
		"res://assets/sprites/fx/focus_ring_pulse_1.png",
		"res://assets/sprites/fx/focus_ring_pulse_2.png",
		"res://assets/sprites/fx/focus_ring.png",
	]:
		if ResourceLoader.exists(p):
			_frames.append(load(p))
	if _frames.is_empty():
		# 几何回退
		var ell := Polygon2D.new()
		ell.polygon = _ellipse_pts(30, 12, 28)
		ell.color = Color(0.961, 0.620, 0.043, 0.42)
		add_child(ell)
		var arrow := Polygon2D.new()
		arrow.polygon = PackedVector2Array([Vector2(34, -7), Vector2(50, 0), Vector2(34, 7)])
		arrow.color = Color(0.961, 0.620, 0.043, 0.9)
		add_child(arrow)
		_sprite.visible = false
	else:
		_sprite.texture = _frames[0]

func _process(delta: float) -> void:
	_t += delta
	var s := 1.0 + 0.08 * sin(_t * 4.2)
	scale = Vector2(s, s * 0.85)
	if _frames.size() >= 2:
		_accum += delta
		if _accum >= 0.22:
			_accum = 0.0
			_fi = (_fi + 1) % mini(3, _frames.size())
			_sprite.texture = _frames[_fi]

static func _ellipse_pts(rx: float, ry: float, n: int) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in n:
		var a := TAU * float(i) / float(n)
		pts.append(Vector2(cos(a) * rx, sin(a) * ry))
	return pts
