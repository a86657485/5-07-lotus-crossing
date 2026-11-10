extends SceneTree

var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)

func _run() -> void:
	var scene = load("res://scenes/Main.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	await process_frame
	var station = scene.s3
	_check(station != null, "S3 scene exists")
	if station == null:
		quit(1)
		return
	station.open_station()
	station._pick("strat", "st_car_long")
	_check(station.strategy_id == "", "strategy locked until baseline")
	station._run()
	_check(station.fault_observed, "baseline observed")
	_check(station.run_history.size() == 1, "baseline recorded once")
	_check(int(station.run_history[0].remainingCars) == 9, "baseline queue")
	station._pick("strat", "st_same")
	station._pick("reason", "rs_evacuate")
	station._run()
	_check(not station.revalidate_ok, "unchanged green does not improve queue")
	_check(not bool(station.first_attempt.correct), "first attempt retained")
	station._pick("strat", "st_car_long")
	station._run()
	_check(station.revalidate_ok, "adjusted green and reason verified")
	_check(int(station.run_history.back().remainingCars) == 6, "adjusted queue")
	_check(station.revision_count == 1, "revision recorded")
	_check(int(station.run_history.back().pedestrianUnits) == 6, "pedestrian duration unchanged")
	station.open_station()
	_check(station.revalidate_ok and station.run_history.size() == 3, "state restored when reopening")
	station._pick("strat", "st_longest")
	_check(not station.revalidate_ok, "changed rule invalidates verification")
	station._undo()
	_check(station.strategy_id == "st_car_long", "undo restores previous choice")
	_check(not station.revalidate_ok, "undo still requires rerun")
	if "--snapshot" in OS.get_cmdline_user_args():
		await process_frame
		await process_frame
		root.get_texture().get_image().save_png("/tmp/g5l7-s3-timing.png")
	if failures.is_empty():
		print("S3 timing: all checks passed")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
