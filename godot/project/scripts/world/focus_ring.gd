extends Node2D
## 脚底半透明琥珀椭圆脉冲 + 侧向小箭头（挂在角色脚下本地坐标）

@onready var _ellipse: Polygon2D = $Ellipse
@onready var _arrow: Polygon2D = $Arrow

var _t: float = 0.0

func _ready() -> void:
	position = Vector2(0, 18)
	z_index = -1
	if _ellipse:
		_ellipse.color = Color(0.961, 0.620, 0.043, 0.45)
	if _arrow:
		_arrow.color = Color(0.961, 0.620, 0.043, 0.85)

func _process(delta: float) -> void:
	_t += delta
	var s := 1.0 + 0.08 * sin(_t * 4.0)
	scale = Vector2(s, s * 0.55)
