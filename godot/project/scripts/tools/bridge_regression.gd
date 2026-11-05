extends SceneTree
## Godot/JS bridge regression; exits non-zero on any failed check.

var failed := 0
var checked := 0
var state: Node
var bridge: Node

func _initialize() -> void:
	call_deferred("_run")

func _check(actual: Variant, expected: Variant, label: String) -> void:
	checked += 1
	if actual != expected:
		failed += 1
		push_error("FAIL %s: expected %s, got %s" % [label, expected, actual])

func _run() -> void:
	await process_frame
	await process_frame
	state = root.get_node("GameState")
	bridge = root.get_node("ClassroomBridge")
	if _test_session() != true:
		failed += 1
	if _test_relic_sync() != true:
		failed += 1
	if await _test_s3_revision() != true:
		failed += 1
	print("[bridge-regression] checks=", checked, " failed=", failed)
	quit(1 if failed else 0)

func _test_session() -> bool:
	var stations := {
		"s1_order": true, "s2_rewrite": true, "s2_vs_branch": true,
		"s2_kettle": true, "s3_timing": false, "exam": false,
	}
	var detail := {
		"faultObserved": true, "scenario": "car_heavy", "strategy": "st_car_long",
		"reason": "rs_evacuate", "ruleChanged": true, "revalidateOk": false,
	}
	var session := {
		"studentId": "bridge-test-501", "classId": "501", "displayName": "桥接测试",
		"runId": "bridge-test-run", "isTest": true, "relicRemaining": 1,
		"stations": stations, "s3Detail": detail,
		"relics": {"remaining": 1, "unlockedRelics": {"whistle": true, "arrow": true, "knob": false}},
	}
	bridge._js_session([JSON.stringify(session)])
	_check(state.student_id, "bridge-test-501", "JSON student identity")
	_check(state.display_name, "桥接测试", "JSON display name")
	_check(state.run_id, "bridge-test-run", "JSON run identity")
	_check(state.stations, stations, "JSON stations")
	_check(state.s3_detail, detail, "S3 current detail restoration")
	_check(state.unlocked_relics, session.relics.unlockedRelics, "relic fragments restoration")
	_check(state.relic_remaining, 1, "session remaining quota")
	_check(state.relic_used, 2, "session used quota")
	_check(bridge._to_dict(["[]"]), {}, "non-object JSON ignored")
	_check(bridge._to_dict([session]), session, "dictionary remains supported")
	return true

func _test_relic_sync() -> bool:
	bridge._js_relic_sync([JSON.stringify({"remaining": 0})])
	_check(state.relic_remaining, 0, "zero remaining survives JSON")
	_check(state.relic_used, 3, "spent quota remains three")
	bridge._js_relic_sync([JSON.stringify({"remaining": 2})])
	_check(state.relic_remaining, 2, "updated remaining survives JSON")
	_check(state.relic_used, 1, "used follows authoritative remaining")
	return true

func _test_s3_revision() -> bool:
	state.intro_seen = true
	if change_scene_to_file("res://scenes/Main.tscn") != OK:
		push_error("cannot load scene for S3 revision regression")
		return false
	await process_frame
	await process_frame
	var station: Control = current_scene.s3
	station.open_station()
	station._run()
	station._pick("strat", "st_car_long")
	station._pick("reason", "rs_evacuate")
	station._run()
	state.set_station_done("s3_timing", true)
	_check(state.exam_ready(), true, "current completed stations open exam")
	station._pick("strat", "st_ped_long")
	_check(state.stations.s3_timing, false, "changing rule clears current S3 completion")
	_check(state.exam_ready(), false, "changed rule closes local exam gate")
	_check(state.s3_detail.revalidateOk, false, "changed rule detail requires revalidation")
	_check(state.s3_detail.strategy, "st_ped_long", "changed strategy is reported in current detail")
	return true
