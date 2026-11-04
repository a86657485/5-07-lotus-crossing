extends SceneTree
## Headless 正路径冒烟：导入跳过 → S1→S2→S3 自动点通

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	await process_frame
	await process_frame
	var scene := current_scene
	if scene == null:
		push_error("no current scene")
		quit(2)
		return
	print("[smoke] scene=", scene.name, " font=", UiTheme.ui_font != null)
	GameState.intro_seen = true
	if scene.has_method("_show_hub"):
		scene._show_hub()
	await process_frame
	# Close story if still open
	if scene.story_replay and scene.story_replay.visible:
		scene.story_replay.visible = false
	scene._open_s1()
	await process_frame
	var s1 = scene.s1
	for id in ["arrive", "wait_green", "green_go", "cross_alert", "arrive_other"]:
		s1._on_pool_pick(id)
	s1._submit()
	await process_frame
	s1._on_pick_waiting("wait_green")
	s1._submit()
	await process_frame
	print("[smoke] after S1 stations=", GameState.stations)
	if scene.learn_card and scene.learn_card.visible:
		scene.learn_card.get_node("VBox/HBox/NextBtn").pressed.emit()
		await process_frame
	if scene.s2a.visible:
		scene.s2a._pick("cond", "cond_not_green", "")
		scene.s2a._pick("repeat", "repeat_observe", "")
		scene.s2a._pick("back", "back_to_repeat", "")
		scene.s2a._lock()
		await process_frame
	print("[smoke] after S2A", GameState.stations)
	if scene.s2b.visible:
		scene.s2b._select("loop")
		scene.s2b._submit()
		await process_frame
	print("[smoke] after S2B", GameState.stations)
	if scene.s2c.visible:
		scene.s2c._pick("cond", "water_low")
		scene.s2c._pick("repeat", "keep_heat")
		scene.s2c._pick("timing", "ask_first")
		scene.s2c._submit()
		await process_frame
	print("[smoke] after S2C", GameState.stations)
	scene._open_s3()
	await process_frame
	if scene.s3.visible:
		scene.s3._run()
		scene.s3._pick("strat", "extend_green_car")
		scene.s3._pick("reason", "serve_junction")
		scene.s3._run()
		scene.s3._submit()
		await process_frame
	print("[smoke] FINAL stations=", GameState.stations)
	var ok := bool(GameState.stations["s1_order"]) and bool(GameState.stations["s2_rewrite"]) and bool(GameState.stations["s2_vs_branch"]) and bool(GameState.stations["s2_kettle"]) and bool(GameState.stations["s3_timing"])
	print("[smoke] result_ok=", ok, " font_ok=", UiTheme.ui_font != null)
	quit(0 if ok else 1)
