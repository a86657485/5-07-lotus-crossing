extends Control
## S3 布置≠运行；faultObserved → 策略/理由 → revalidateOk

signal completed(payload: Dictionary)
signal cancelled

const STRATEGY_OK := "extend_green_car"
const REASON_OK := "serve_junction"

var fault_observed: bool = false
var strategy_id: String = ""
var reason_id: String = ""
var rule_changed: bool = false
var revalidate_ok: bool = false

@onready var prompt: Label = $Panel/VBox/Prompt
@onready var traffic_l: Label = $Panel/VBox/TrafficBar
@onready var run_btn: Button = $Panel/VBox/Tools/RunBtn
@onready var strat_row: HBoxContainer = $Panel/VBox/StratRow
@onready var reason_row: HBoxContainer = $Panel/VBox/ReasonRow
@onready var submit_btn: Button = $Panel/VBox/Tools/SubmitBtn
@onready var back_btn: Button = $Panel/VBox/Tools/BackBtn
@onready var gate_l: Label = $Panel/VBox/GateHint

func _ready() -> void:
	run_btn.pressed.connect(_run)
	submit_btn.pressed.connect(_submit)
	back_btn.pressed.connect(func(): cancelled.emit())
	_fill()

func open_station() -> void:
	visible = true
	fault_observed = false
	strategy_id = ""
	reason_id = ""
	rule_changed = false
	revalidate_ok = false
	prompt.text = "阿莲：调度亭这边交给你。先运行，看哪边堵。\n领队：开放日车流还在涨，快点稳住。"
	traffic_l.text = "车流条：尚未运行"
	_update_gate()

func _fill() -> void:
	_btn(strat_row, "车多：加长该向绿灯", STRATEGY_OK, "strat")
	_btn(strat_row, "全向同时加长(干扰)", "all_long", "strat")
	_btn(reason_row, "小设置服务整条路口", REASON_OK, "reason")
	_btn(reason_row, "因为叫「智慧」路口(干扰)", "smart_name", "reason")
	_btn(reason_row, "随便设也行(干扰)", "random", "reason")

func _btn(parent: HBoxContainer, text: String, id: String, kind: String) -> void:
	var b := Button.new()
	b.text = text
	b.pressed.connect(_pick.bind(kind, id))
	parent.add_child(b)

func _pick(kind: String, id: String) -> void:
	if not fault_observed:
		gate_l.text = "阿莲：先运行，看哪边堵。"
		ClassroomBridge.gate_state(GameState.TASK_S3, "pre_missing")
		return
	match kind:
		"strat":
			strategy_id = id
			rule_changed = true
		"reason":
			reason_id = id
			rule_changed = true
	revalidate_ok = false
	traffic_l.text = "规则已改，路口暂不变——请再运行核对。"
	_update_gate()

func _run() -> void:
	if not fault_observed:
		fault_observed = true
		traffic_l.text = "拥堵！车多方向绿灯极短，行人空等。（故障已见）"
		_update_gate()
		return
	# revalidate
	if strategy_id == STRATEGY_OK and reason_id == REASON_OK:
		revalidate_ok = true
		traffic_l.text = "拥堵缓解动画 ✓（可关）路口顺多了。"
	else:
		revalidate_ok = false
		traffic_l.text = "再运行仍堵。检查策略与理由。"
		var n := GameState.bump_fail(GameState.TASK_S3)
		ClassroomBridge.request_scaffold(GameState.TASK_S3, mini(n, 3), "M7")
	_update_gate()

func _update_gate() -> void:
	var g := "pre_missing"
	if fault_observed and not (strategy_id != "" and reason_id != "" and revalidate_ok):
		if strategy_id == "" or reason_id == "" or not revalidate_ok:
			g = "pre_done_unverified"
	if fault_observed and revalidate_ok:
		g = "verified_ready"
	match g:
		"pre_missing":
			gate_l.text = "阿莲：先运行，看哪边堵。"
		"pre_done_unverified":
			gate_l.text = "阿莲：别再空跑故障，先换时长。"
		"verified_ready":
			gate_l.text = "重验通过，可以锁定通关。"
	ClassroomBridge.gate_state(GameState.TASK_S3, g)
	GameState.s3_detail = {
		"faultObserved": fault_observed,
		"scenario": "car_heavy",
		"strategy": strategy_id,
		"reason": reason_id,
		"ruleChanged": rule_changed,
		"revalidateOk": revalidate_ok,
	}

func _submit() -> void:
	if not (fault_observed and revalidate_ok and strategy_id == STRATEGY_OK and reason_id == REASON_OK):
		gate_l.text = "尚未完成：故障实测 ∧ 策略理由正确 ∧ 重验通过。"
		return
	completed.emit({
		"evidenceCode": "E4",
		"attemptKind": "revision" if int(GameState.fail_counts.get(GameState.TASK_S3, 0)) > 0 else "first",
		"correct": true,
		"payload": {
			"capture": "in_world_action",
			"faultObserved": true,
			"strategyId": strategy_id,
			"reasonId": reason_id,
			"revalidateOk": true,
		},
		"s3Detail": GameState.s3_detail.duplicate(),
	})
