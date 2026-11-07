extends SceneTree

var failures: Array[String] = []
var s1_events: Array = []

func _initialize() -> void:
	call_deferred("_run")

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)

func _run() -> void:
	Engine.time_scale = 30.0
	var s1 = load("res://scripts/stations/s2_rewrite.gd").new()
	root.add_child(s1)
	await process_frame
	s1.open_station()
	await process_frame
	var board = s1.board
	s1.completed.connect(func(data): s1_events.append(data))
	_check(not str(board.config.nodes[2].placeholder).contains("绿灯"), "condition placeholder must not reveal answer")
	_check(not str(board.highlight_next()).contains("绿灯未亮起"), "operation hint must not reveal answer")
	board._support_used = false
	board._on_pool_pick("cond_green_off")
	board.wires = {"yes": "observe", "no": "cross"}
	var correct: Dictionary = board._evaluate()
	_check(bool(correct.ok), "S1 correct condition and edges accepted")
	await board._run_crossing_case(correct)
	_check(s1_events.is_empty(), "first condition alone cannot complete S1")
	_check(board._case_results[0].outcome == "crossed_green", "already green exits")
	_check(int(board._case_results[0].observations) == 1, "already green observes once")
	await board._run_crossing_case(correct)
	_check(s1_events.size() == 1, "two correct cases complete S1")
	_check(board._case_results[1].outcome == "crossed_green", "red then green exits")
	_check(int(board._case_results[1].observations) == 3, "red case observes twice before green")
	board.setup(s1._config())
	board._on_pool_pick("cond_green_off")
	board.wires = {"yes": "cross", "no": "observe"}
	var wrong: Dictionary = board._evaluate()
	await board._run_crossing_case(wrong)
	await board._run_crossing_case(wrong)
	_check(board._case_results[0].outcome == "step_limit", "reversed edge loops when initially green")
	_check(board._case_results[1].outcome == "red_blocked", "reversed edge stops at red safely")
	_check(s1_events.size() == 1, "wrong edges do not complete S1")
	_check(board._attempt_history.size() == 1 and not board._attempt_history[0].correct, "failed attempt retained")

	var vs = load("res://scripts/stations/s2_vs_branch.gd").new()
	root.add_child(vs)
	await process_frame
	vs.open_station()
	var vb = vs.board
	vb.config["left_hit"] = Rect2(30, 20, 300, 280)
	vb.config["right_hit"] = Rect2(370, 20, 300, 280)
	vb.config["back_hit"] = Rect2(70, 100, 40, 100)
	vb._handle_side_pick(Vector2(450, 80))
	_check(vb._next_missing() == "" and not vb._evaluate().ok, "branch may be submitted as a wrong attempt")
	vb._handle_side_pick(Vector2(200, 70))
	_check(vb._next_missing() == "wire:yes", "loop requires back edge")
	vb._handle_side_pick(Vector2(90, 130))
	_check(bool(vb._evaluate().ok), "visible back edge can be clicked")
	if "--snapshot" in OS.get_cmdline_user_args():
		s1.visible = false
		vb.setup(vs._config())
		await process_frame
		await process_frame
		root.get_texture().get_image().save_png("/tmp/g5l7-s2-compare.png")

	var kettle = load("res://scripts/stations/s2_kettle.gd").new()
	root.add_child(kettle)
	await process_frame
	kettle.open_station()
	var kb = kettle.board
	kb._on_pool_pick("k_repeat_check")
	kb._on_pool_pick("k_stop_at_100")
	kb._on_pool_pick("k_timing_ask_first")
	_check(bool(kb._evaluate().ok), "read water temperature is a valid repeating step")
	kb.undo_step()
	_check(not kb.filled.has("timing") and kb.filled.has("repeat"), "undo preserves earlier choices")
	kb.reset_board()
	kb._on_pool_pick("k_repeat_heat")
	kb._on_pool_pick("k_stop_at_100")
	kb._on_pool_pick("k_timing_ask_first")
	_check(bool(kb._evaluate().ok), "continue heating is also a valid repeating step")
	kb.reset_board()
	kb._on_pool_pick("k_repeat_stop")
	kb._on_pool_pick("k_stop_at_100")
	kb._on_pool_pick("k_timing_ask_first")
	_check(not kb._evaluate().ok, "stopping is not a repeating step")
	if "--snapshot" in OS.get_cmdline_user_args():
		s1.visible = false
		vs.visible = false
		kb.setup(kettle._config())
		await process_frame
		await process_frame
		root.get_texture().get_image().save_png("/tmp/g5l7-s2-kettle.png")

	if "--snapshot" in OS.get_cmdline_user_args():
		kettle.visible = false
		vs.visible = false
		board.setup(s1._config())
		s1.visible = true
		await process_frame
		await process_frame
		root.get_texture().get_image().save_png("/tmp/g5l7-s1-redesign.png")
	if failures.is_empty():
		print("Stations 1 and 2: all checks passed")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
