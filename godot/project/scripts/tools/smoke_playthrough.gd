extends SceneTree
## Current scene/programmatic smoke; real browser/student UI acceptance is separate.

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var ok = await _playthrough()
	print("[smoke] result_ok=", ok == true)
	quit(0 if ok == true else 1)

func _finish_dialogue(scene: Node) -> void:
	for _step in range(20):
		if not scene.dialogue.visible:
			return
		scene.dialogue._on_next()

func _playthrough() -> bool:
	await process_frame
	var state := root.get_node("GameState")
	state.intro_seen = true
	if change_scene_to_file("res://scenes/Main.tscn") != OK:
		push_error("cannot load main scene")
		return false
	await process_frame
	await process_frame
	var scene := current_scene
	if scene == null:
		push_error("no current scene")
		return false
	print("[smoke] scene=", scene.name)
	scene._open_s1()
	_finish_dialogue(scene)
	var board: Control = scene.s1.board
	board._on_pool_pick("cond_green_off")
	board.wires = {"yes": "observe", "no": "cross"}
	board._on_submit()
	_finish_dialogue(scene)
	if not bool(state.stations.s1_order) or not bool(state.stations.s2_rewrite):
		push_error("S1 current flowchart did not complete")
		return false
	scene.learn_card.get_node("VBox/HBox/NextBtn").pressed.emit()
	_finish_dialogue(scene)
	board = scene.s2b.board
	board._on_intent_card("intent_loop")
	board._on_intent_card("mark_back_edge")
	board._on_submit()
	if not bool(state.stations.s2_vs_branch):
		push_error("S2 contrast did not complete")
		return false
	board = scene.s2c.board
	for card in ["k_repeat_check", "k_cond", "k_repeat_heat", "k_timing_ask_first"]:
		board._on_pool_pick(card)
	board.wires = {"yes": "check", "no": "stop"}
	board._on_submit()
	if not bool(state.stations.s2_kettle):
		push_error("S2 kettle did not complete")
		return false
	scene._open_s3()
	_finish_dialogue(scene)
	scene.s3._run()
	scene.s3._pick("strat", "st_car_long")
	scene.s3._pick("reason", "rs_evacuate")
	scene.s3._run()
	scene.s3._submit()
	_finish_dialogue(scene)
	await process_frame
	var ok: bool = state.exam_ready() and state.stations.s1_order
	print("[smoke] FINAL stations=", state.stations, " s3Detail=", state.s3_detail)
	return ok
