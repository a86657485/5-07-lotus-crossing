extends Node
## 全课进度真相源（与 taskId 锁定一致）

signal stations_changed
signal relic_changed
signal gate_changed(task_id: String, gate_state: String)
signal exam_opened
signal focus_target_changed(target_id: String)

const TASK_S1 := "s1_order"
const TASK_S2A := "s2_rewrite"
const TASK_S2B := "s2_vs_branch"
const TASK_S2C := "s2_kettle"
const TASK_S3 := "s3_timing"
const TASK_EXAM := "exam"

var student_id: String = ""
var class_id: String = ""
var display_name: String = ""
var run_id: String = ""
var is_test: bool = false

var stations: Dictionary = {
	"s1_order": false,
	"s2_rewrite": false,
	"s2_vs_branch": false,
	"s2_kettle": false,
	"s3_timing": false,
	"exam": false,
}

var relic_quota: int = 3
var relic_used: int = 0
var relic_remaining: int = 3
var unlocked_relics: Dictionary = {"whistle": false, "arrow": false, "knob": false}

var s3_detail: Dictionary = {
	"faultObserved": false,
	"scenario": "car_heavy",
	"strategy": "",
	"reason": "",
	"ruleChanged": false,
	"revalidateOk": false,
}

var gate_states: Dictionary = {
	"s1_order": "pre_missing",
	"s2_rewrite": "pre_missing",
	"s2_vs_branch": "pre_missing",
	"s2_kettle": "pre_missing",
	"s3_timing": "pre_missing",
}

var intro_seen: bool = false
var current_focus: String = "teleport_s1"
var active_station: String = ""  # hub | s1 | s2a | s2b | s2c | s3 | intro
var fail_counts: Dictionary = {}

func apply_session(data: Dictionary) -> void:
	student_id = str(data.get("studentId", student_id))
	class_id = str(data.get("classId", class_id))
	display_name = str(data.get("displayName", display_name))
	run_id = str(data.get("runId", run_id))
	is_test = bool(data.get("isTest", false))
	if data.has("relicRemaining"):
		relic_remaining = int(data["relicRemaining"])
		relic_used = maxi(0, relic_quota - relic_remaining)
	relic_changed.emit()

func sync_stations(src: Dictionary) -> void:
	for k in stations.keys():
		if src.has(k):
			stations[k] = bool(src[k])
	stations_changed.emit()

func set_station_done(task_id: String, done: bool = true) -> void:
	if not stations.has(task_id):
		return
	stations[task_id] = done
	stations_changed.emit()
	_maybe_open_exam()

func set_gate(task_id: String, gate_state: String) -> void:
	gate_states[task_id] = gate_state
	gate_changed.emit(task_id, gate_state)

func bump_fail(task_id: String) -> int:
	fail_counts[task_id] = int(fail_counts.get(task_id, 0)) + 1
	return int(fail_counts[task_id])

func reset_station(task_id: String) -> void:
	match task_id:
		TASK_S1:
			stations[TASK_S1] = false
			fail_counts[TASK_S1] = 0
			set_gate(TASK_S1, "pre_missing")
		TASK_S2A, TASK_S2B, TASK_S2C:
			stations[TASK_S2A] = false
			stations[TASK_S2B] = false
			stations[TASK_S2C] = false
			for t in [TASK_S2A, TASK_S2B, TASK_S2C]:
				fail_counts[t] = 0
				set_gate(t, "pre_missing")
		TASK_S3:
			stations[TASK_S3] = false
			fail_counts[TASK_S3] = 0
			s3_detail = {
				"faultObserved": false,
				"scenario": "car_heavy",
				"strategy": "",
				"reason": "",
				"ruleChanged": false,
				"revalidateOk": false,
			}
			set_gate(TASK_S3, "pre_missing")
	stations_changed.emit()

func s1_unlocked() -> bool:
	return true

func s2_unlocked() -> bool:
	return bool(stations[TASK_S1])

func s3_unlocked() -> bool:
	return bool(stations[TASK_S2A]) and bool(stations[TASK_S2B]) and bool(stations[TASK_S2C])

func exam_ready() -> bool:
	return s3_unlocked() and bool(stations[TASK_S3])

func _maybe_open_exam() -> void:
	if exam_ready() and not bool(stations[TASK_EXAM]):
		exam_opened.emit()

func set_focus(target_id: String) -> void:
	current_focus = target_id
	focus_target_changed.emit(target_id)

func consume_relic_local() -> bool:
	if relic_remaining <= 0:
		return false
	relic_remaining -= 1
	relic_used += 1
	relic_changed.emit()
	return true
