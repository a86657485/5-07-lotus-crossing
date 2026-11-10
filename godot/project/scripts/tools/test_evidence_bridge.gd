extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	await process_frame
	var bridge := root.get_node("ClassroomBridge")
	var state := root.get_node("GameState")
	var data: Dictionary = bridge._to_dict(['{"studentId":"fake-1","introSeen":true,"stations":{"s1_order":true},"s3Detail":{"faultObserved":true,"strategy":"st_car_long"}}'])
	if data.get("studentId") != "fake-1":
		push_error("JavaScript session JSON was not decoded")
		quit(1)
		return
	bridge._on_app_session(data)
	if state.student_id != "fake-1" or not state.intro_seen or not state.stations.s1_order or not state.s3_detail.faultObserved or state.s3_detail.strategy != "st_car_long":
		push_error("Session progress was not restored")
		quit(1)
		return
	print("Evidence bridge session decoding and restore passed")
	quit(0)
