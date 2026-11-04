extends Control

@onready var label: Label = $Bar/Label

func set_prompt(text: String) -> void:
	visible = text.strip_edges() != ""
	if label:
		label.text = text
