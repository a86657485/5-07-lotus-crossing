extends CharacterBody2D
## Q版橙马甲占位玩家

const SPEED := 180.0

@onready var body_rect: ColorRect = $Body
@onready var vest_rect: ColorRect = $Vest
@onready var head_rect: ColorRect = $Head

var can_move: bool = true

func _ready() -> void:
	if body_rect:
		body_rect.color = Color("E0F2FE")
	if vest_rect:
		vest_rect.color = Color("F97316")
	if head_rect:
		head_rect.color = Color("FDE68A")

func _physics_process(_delta: float) -> void:
	if not can_move:
		velocity = Vector2.ZERO
		move_and_slide()
		return
	var dir := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	velocity = dir * SPEED
	move_and_slide()

func teleport_to(pos: Vector2) -> void:
	global_position = pos
