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
var exam_available: bool = false
var current_focus: String = "teleport_s1"
var active_station: String = ""  # hub | s1 | s2a | s2b | s2c | s3 | intro
var fail_counts: Dictionary = {}

func apply_session(data: Dictionary) -> void:
	if data.has("examOpen"):
		exam_available = bool(data["examOpen"])
	if bool(data.get("introSeen", false)):
		intro_seen = true
	student_id = str(data.get("studentId", student_id))
	class_id = str(data.get("classId", class_id))
	display_name = str(data.get("displayName", display_name))
	run_id = str(data.get("runId", run_id))
	is_test = bool(data.get("isTest", false))
	if data.has("relicRemaining"):
		relic_remaining = int(data["relicRemaining"])
		relic_used = maxi(0, relic_quota - relic_remaining)
	if data.has("s3Detail") and data["s3Detail"] is Dictionary:
		s3_detail.merge(data["s3Detail"], true)
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
		TASK_S2A:
			# S1 主证据（E1）；不连带清 E2/E3
			stations[TASK_S2A] = false
			stations[TASK_S1] = false
			fail_counts[TASK_S2A] = 0
			fail_counts[TASK_S1] = 0
			set_gate(TASK_S2A, "pre_missing")
			set_gate(TASK_S1, "pre_missing")
		TASK_S2B:
			stations[TASK_S2B] = false
			fail_counts[TASK_S2B] = 0
			set_gate(TASK_S2B, "pre_missing")
		TASK_S2C:
			stations[TASK_S2C] = false
			fail_counts[TASK_S2C] = 0
			set_gate(TASK_S2C, "pre_missing")
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
	# S1 主证据落在 s2_rewrite（E1）；s1_order 仅附属
	return bool(stations[TASK_S2A]) or bool(stations[TASK_S1])

func s3_unlocked() -> bool:
	# S2 仅 E2+E3；E1 已在 S1 完成（TASK_S2A）
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
