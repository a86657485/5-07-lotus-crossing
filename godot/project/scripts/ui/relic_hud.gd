extends Control
## 右上角通关法宝配额 3；指路不代做

signal use_pressed

@onready var count_label: Label = $HBox/Count
@onready var use_btn: Button = $HBox/UseBtn

func _ready() -> void:
	use_btn.pressed.connect(func(): use_pressed.emit())
	GameState.relic_changed.connect(_refresh)
	_refresh()

func _refresh() -> void:
	count_label.text = "法宝 %d/%d" % [GameState.relic_remaining, GameState.relic_quota]
	use_btn.disabled = GameState.relic_remaining <= 0
