extends CharacterBody2D
## 玩家四向：优先 AI 路径

const SPEED := 180.0

var can_move: bool = true
var _facing: String = "down"
var _tex: Dictionary = {}

func _ready() -> void:
	for d in ["down", "left", "right", "up"]:
		var paths := [
			"res://assets/sprites/ai/characters/player_%s.png" % d,
			"res://assets/sprites/player/idle_%s.png" % d,
		]
		for path in paths:
			if ResourceLoader.exists(path):
				_tex[d] = load(path)
				break
	_apply_facing("down")

func _physics_process(_delta: float) -> void:
	if not can_move:
		velocity = Vector2.ZERO
		move_and_slide()
		return
	var dir := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	velocity = dir * SPEED
	if dir.length() > 0.1:
		if abs(dir.x) > abs(dir.y):
			_apply_facing("right" if dir.x > 0.0 else "left")
		else:
			_apply_facing("down" if dir.y > 0.0 else "up")
	move_and_slide()

func _apply_facing(face: String) -> void:
	_facing = face
	var sp := get_node_or_null("Sprite") as Sprite2D
	if sp and _tex.has(face):
		sp.texture = _tex[face]

func teleport_to(pos: Vector2) -> void:
	global_position = pos
