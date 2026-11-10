extends Control
## 教材式流程图板：绿起止／浅蓝处理／蓝菱形／「是」回边／「否」前进
## 填菱形卡＋菱形出口拉线柄；⌫ 撤回；未作答选项零高亮

signal board_changed
signal submitted(ok: bool, detail: Dictionary)
signal cancelled
signal tip_changed(text: String)

enum NodeKind { START, PROCESS, DECISION, END }

const COLOR_START := Color("86EFAC")
const COLOR_PROCESS := Color("BAE6FD")
const COLOR_DECISION := Color("38BDF8")
const COLOR_ARROW := Color("2563EB")
const COLOR_YES_EDGE := Color("F97316")
const COLOR_SLOT_EMPTY := Color(0.85, 0.9, 0.95, 0.55)
const COLOR_SLOT_FOCUS := Color("F59E0B")

var config: Dictionary = {}
var filled: Dictionary = {}       # slot_id -> card_id
var wires: Dictionary = {}        # wire_id -> target_node_id  ("yes"|"no")
var _history: Array = []
var _mode: String = "fill"        # fill | pick_side | wire
var _pick_side: String = ""
var _wire_from: String = ""       # "yes" | "no" | ""
var _edge_hits: Dictionary = {}   # handle_id -> Rect2
var _node_hits: Dictionary = {}   # node_id -> Rect2
var _locked: bool = false
var _running: bool = false
var _case_results: Array = []
var _attempt_history: Array = []
var _support_used: bool = false
var _sim_node: String = ""
var _sim_light: String = "red"
var _sim_person: String = "等待"
var _sim_status: String = "准备测试"
var _crossing_background: Texture2D
var _kettle_temperature: int = 80
var _kettle_heating: bool = false
var _kettle_status: String = "准备模拟"

var prompt_label: Label
var feedback_label: Label
var canvas: Control
var pool: Container
var tools: HBoxContainer
var undo_btn: Button
var submit_btn: Button
var back_btn: Button
var next_hint: Label

func setup(p_config: Dictionary) -> void:
	config = p_config
	filled.clear()
	wires.clear()
	_history.clear()
	_pick_side = ""
	_wire_from = ""
	_locked = false
	_running = false
	_case_results.clear()
	_attempt_history.clear()
	_support_used = false
	_sim_node = ""
	_sim_light = "red"
	_sim_person = "等待"
	_sim_status = "准备测试"
	_kettle_temperature = 80
	_kettle_heating = false
	_kettle_status = "准备模拟"
	_mode = str(config.get("mode", "fill"))
	if not is_inside_tree():
		await ready
	_ensure_ui()
	submit_btn.text = str(config.get("submit_text", "锁定并回放"))
	_rebuild_pool()
	_refresh()
	if canvas:
		canvas.queue_redraw()

func open_board() -> void:
	visible = true
	_wire_from = ""
	if prompt_label:
		prompt_label.text = str(config.get("prompt", "把缺失的图元点进流程图。"))
	_rebuild_pool()
	_refresh()

func reset_board() -> void:
	filled.clear()
	wires.clear()
	_history.clear()
	_pick_side = ""
	_wire_from = ""
	_locked = false
	_rebuild_pool()
	_refresh()

func unlock_edit() -> void:
	_locked = false
	if submit_btn:
		submit_btn.text = str(config.get("submit_text", "锁定并回放"))

func highlight_next() -> String:
	_support_used = true
	var miss := _next_missing()
	if miss == "":
		return str(config.get("relic_ready", "可以锁定了——检查菱形与「是／否」连线。"))
	var tips: Dictionary = config.get("slot_tips", {})
	return str(tips.get(miss, "按琥珀色提示操作下一步（不代做）。"))

func _ensure_ui() -> void:
	if prompt_label != null:
		return
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var root_vb := VBoxContainer.new()
	root_vb.name = "RootVB"
	root_vb.set_anchors_preset(Control.PRESET_FULL_RECT)
	root_vb.offset_left = 8
	root_vb.offset_top = 8
	root_vb.offset_right = -8
	root_vb.offset_bottom = -8
	add_child(root_vb)
	prompt_label = Label.new()
	prompt_label.name = "Prompt"
	prompt_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	prompt_label.custom_minimum_size = Vector2(0, 48)
	root_vb.add_child(prompt_label)
	next_hint = Label.new()
	next_hint.name = "NextHint"
	next_hint.modulate = COLOR_SLOT_FOCUS
	root_vb.add_child(next_hint)
	canvas = Control.new()
	canvas.name = "FlowCanvas"
	canvas.custom_minimum_size = Vector2(0, 320)
	canvas.size_flags_vertical = Control.SIZE_EXPAND_FILL
	canvas.draw.connect(_draw_canvas)
	canvas.gui_input.connect(_on_canvas_input)
	root_vb.add_child(canvas)
	feedback_label = Label.new()
	feedback_label.name = "Feedback"
	feedback_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	root_vb.add_child(feedback_label)
	var pool_title := Label.new()
	pool_title.text = "选择卡片，或在图上操作"
	root_vb.add_child(pool_title)
	pool = HFlowContainer.new()
	pool.name = "Pool"
	pool.add_theme_constant_override("h_separation", 8)
	pool.add_theme_constant_override("v_separation", 8)
	root_vb.add_child(pool)
	tools = HBoxContainer.new()
	tools.name = "Tools"
	tools.add_theme_constant_override("separation", 12)
	root_vb.add_child(tools)
	undo_btn = Button.new()
	undo_btn.text = "⌫ 撤回"
	undo_btn.pressed.connect(undo_step)
	tools.add_child(undo_btn)
	submit_btn = Button.new()
	submit_btn.text = str(config.get("submit_text", "锁定并回放"))
	submit_btn.pressed.connect(_on_submit)
	tools.add_child(submit_btn)
	back_btn = Button.new()
	back_btn.text = "回地图"
	back_btn.pressed.connect(func(): cancelled.emit())
	tools.add_child(back_btn)

func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("undo_step"):
		undo_step()
		get_viewport().set_input_as_handled()

func _rebuild_pool() -> void:
	if pool == null:
		return
	for c in pool.get_children():
		c.queue_free()
	if _mode == "pick_side":
		return
	var used := {}
	for sid in filled.keys():
		used[filled[sid]] = true
	for card in config.get("cards", []):
		if card.has("slot") and str(card.get("slot")) != _next_card_slot():
			continue
		var cid := str(card.get("id", ""))
		if str(card.get("kind", "shape")) == "hint":
			continue
		if used.has(cid):
			continue
		var b := Button.new()
		b.text = str(card.get("text", cid))
		b.custom_minimum_size = Vector2(150, 44)
		b.pressed.connect(_on_pool_pick.bind(cid))
		pool.add_child(b)

func _on_pool_pick(card_id: String) -> void:
	if _locked:
		return
	var slot := _next_card_slot()
	if slot == "":
		if feedback_label:
			feedback_label.text = "空槽已满，可 ⌫ 撤回后再改。"
		return
	_history.push_back({"op": "fill", "slot": slot, "card": card_id})
	filled[slot] = card_id
	_after_change()

func _on_intent_card(card_id: String) -> void:
	if _locked:
		return
	var prev := _pick_side
	if card_id == "intent_loop" or card_id == "mark_back_edge":
		_pick_side = "loop"
		if card_id == "mark_back_edge":
			wires["yes"] = str(config.get("back_target", "observe"))
	elif card_id == "intent_branch" or card_id == "mark_branch_exit":
		_pick_side = "branch"
	else:
		_pick_side = "other"
	_history.push_back({"op": "pick", "prev": prev})
	_after_change()

func undo_step() -> void:
	if _running:
		return
	if _locked:
		_locked = false
		if submit_btn:
			submit_btn.text = str(config.get("submit_text", "锁定并回放"))
		if feedback_label:
			feedback_label.text = "已解锁，改后请重锁。"
		return
	if _history.is_empty():
		return
	var h: Dictionary = _history.pop_back()
	match str(h.get("op", "")):
		"fill":
			filled.erase(str(h.get("slot", "")))
		"wire":
			var previous := str(h.get("prev", ""))
			if previous == "":
				wires.erase(str(h.get("wire", "")))
			else:
				wires[str(h.get("wire", ""))] = previous
		"pick":
			_pick_side = str(h.get("prev", ""))
			if str(h.get("prev", "")) != "loop":
				wires.erase("yes")
	_wire_from = ""
	_after_change()

func _after_change() -> void:
	if bool(config.get("crossing_simulation", false)) or bool(config.get("kettle_simulation", false)):
		_case_results.clear()
		_sim_node = ""
		_sim_status = "方案已修改，请重新运行两种情况"
		_kettle_status = "选择已修改，请重新模拟"
		submit_btn.text = "运行80℃" if bool(config.get("kettle_simulation", false)) else "运行第一种情况"
	_rebuild_pool()
	_refresh()
	board_changed.emit()
	if canvas:
		canvas.queue_redraw()

func _next_card_slot() -> String:
	for sid in config.get("slot_order", []):
		var s := str(sid)
		if s.begins_with("wire:"):
			continue
		if not filled.has(s):
			return s
	return ""

func _next_missing() -> String:
	if _mode == "pick_side":
		if _pick_side == "":
			return "pick"
		if _pick_side == "loop" and bool(config.get("need_back_highlight", false)) and not wires.has("yes"):
			return "wire:yes"
		return ""
	for sid in config.get("slot_order", []):
		var s := str(sid)
		if s.begins_with("wire:"):
			var wid := s.substr(5)
			if not wires.has(wid):
				return s
		elif not filled.has(s):
			return s
	return ""

func _refresh() -> void:
	if feedback_label == null:
		return
	var miss := _next_missing()
	var tips: Dictionary = config.get("slot_tips", {})
	if miss == "":
		next_hint.text = "下一步：点「%s」" % submit_btn.text
	else:
		next_hint.text = "下一步：" + str(tips.get(miss, "按提示操作"))
	next_hint.modulate = COLOR_SLOT_FOCUS
	if _mode == "pick_side":
		feedback_label.text = "选择一张图，观察箭头如何走。" if _pick_side == "" else "已选择，检查后运行。"
	else:
		feedback_label.text = str(config.get("idle_feedback", "完成选择后运行。"))
	feedback_label.modulate = Color.WHITE

func _evaluate() -> Dictionary:
	var expect: Dictionary = config.get("expect", {})
	var complete := _next_missing() == ""
	if _mode == "pick_side":
		var ok := _pick_side == str(expect.get("side", "loop"))
		if bool(config.get("need_back_highlight", false)):
			ok = ok and wires.has("yes")
		return {"ok": ok, "complete": complete, "side": _pick_side, "highlightedBackEdge": wires.has("yes")}
	var struct_ok := true
	for sid in expect.get("slots", {}).keys():
		var expected = expect["slots"][sid]
		if expected is Array:
			if not expected.has(filled.get(str(sid), "")):
				struct_ok = false
		elif filled.get(str(sid), "") != str(expected):
			struct_ok = false
	for wid in expect.get("wires", {}).keys():
		if wires.get(str(wid), "") != str(expect["wires"][wid]):
			struct_ok = false
	return {
		"ok": struct_ok and complete,
		"struct_ok": struct_ok,
		"complete": complete,
		"filled": filled.duplicate(),
		"wires": wires.duplicate(),
		"conditionCardId": filled.get("decide", ""),
		"repeatCardId": str(expect.get("repeatCardId", "observe")),
		"backEdgeTo": wires.get("yes", ""),
		"noEdgeTo": wires.get("no", ""),
	}

func _on_submit() -> void:
	if _running:
		return
	var result := _evaluate()
	if not result.get("complete", false):
		feedback_label.text = "还有空缺：菱形条件或「是／否」连线未完成。"
		feedback_label.modulate = Color(1.0, 0.7, 0.3)
		tip_changed.emit(feedback_label.text)
		return
	if bool(config.get("crossing_simulation", false)):
		_run_crossing_case(result)
		return
	if bool(config.get("kettle_simulation", false)):
		_run_kettle_case(result)
		return
	_locked = true
	if not result.get("ok", false):
		feedback_label.text = str(config.get("bad_feedback", "错了：行人乱穿！⌫ 撤回重锁。"))
		feedback_label.modulate = Color(1.0, 0.4, 0.4)
		_locked = false
		submitted.emit(false, result)
		return
	feedback_label.text = str(config.get("ok_feedback", "回放正确 ✓"))
	feedback_label.modulate = Color(0.4, 0.9, 0.5)
	result["lightReplay"] = "loop_then_exit"
	submitted.emit(true, result)

func _on_canvas_input(event: InputEvent) -> void:
	if _locked or _running:
		return
	if not (event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT):
		return
	var local: Vector2 = event.position
	if _mode == "pick_side":
		_handle_side_pick(local)
		return
	# 拉线柄：先点是/否，再点目标框
	if _wire_from != "":
		for nid in _node_hits.keys():
			var r: Rect2 = _node_hits[nid]
			if r.has_point(local):
				_history.push_back({"op": "wire", "wire": _wire_from, "prev": wires.get(_wire_from, "")})
				wires[_wire_from] = str(nid)
				_wire_from = ""
				_after_change()
				return
		_wire_from = ""
		_refresh()
		return
	for hid in _edge_hits.keys():
		var hr: Rect2 = _edge_hits[hid]
		if hr.has_point(local):
			_wire_from = str(hid)
			if next_hint:
				next_hint.text = "下一步：点要接到的步骤"
			if canvas:
				canvas.queue_redraw()
			return

func _handle_side_pick(local: Vector2) -> void:
	var left: Rect2 = config.get("left_hit", Rect2(40, 40, 300, 280))
	var right: Rect2 = config.get("right_hit", Rect2(370, 40, 300, 280))
	var prev := _pick_side
	var back_hit: Rect2 = config.get("back_hit", Rect2())
	if _pick_side == "loop" and back_hit.has_area() and back_hit.has_point(local):
		_history.push_back({"op": "wire", "wire": "yes", "prev": wires.get("yes", "")})
		wires["yes"] = str(config.get("back_target", "observe"))
		_after_change()
		return
	if left.has_point(local):
		_pick_side = "loop"
	elif right.has_point(local):
		_pick_side = "branch"
	else:
		return
	_history.push_back({"op": "pick", "prev": prev})
	_after_change()

func _draw_canvas() -> void:
	if canvas == null:
		return
	_edge_hits.clear()
	_node_hits.clear()
	if _mode == "pick_side":
		_draw_side_by_side()
		return
	for edge in config.get("fixed_edges", []):
		_draw_fixed_edge(edge)
	for node in config.get("nodes", []):
		_draw_node(node)
	_draw_wires()
	if not bool(config.get("hide_handles", false)):
		_draw_handles()
	if bool(config.get("crossing_simulation", false)):
		_draw_crossing()
	if bool(config.get("kettle_diagram", false)):
		_draw_kettle_edges()
	if bool(config.get("kettle_simulation", false)):
		_draw_kettle_simulation()

func _node_rect(node: Dictionary) -> Rect2:
	return Rect2(node.get("pos", Vector2.ZERO), node.get("size", Vector2(200, 48)))

func _draw_node(node: Dictionary) -> void:
	var kind: int = int(node.get("kind", NodeKind.PROCESS))
	var r := _node_rect(node)
	var nid := str(node.get("id", ""))
	_node_hits[nid] = r
	var text := str(node.get("text", ""))
	var is_slot := bool(node.get("slot", false))
	var miss := _next_missing()
	if is_slot:
		if filled.has(nid):
			text = _card_text(filled[nid])
		else:
			text = str(node.get("placeholder", "（空缺菱形）"))
	var col := COLOR_PROCESS
	match kind:
		NodeKind.START, NodeKind.END:
			col = COLOR_START
		NodeKind.DECISION:
			col = COLOR_DECISION if (not is_slot or filled.has(nid)) else COLOR_SLOT_EMPTY
		_:
			col = COLOR_PROCESS
	var focus := (is_slot and not filled.has(nid) and miss == nid) or (nid == _sim_node and _running)
	match kind:
		NodeKind.DECISION:
			_draw_diamond(r, col, text, focus)
		NodeKind.START, NodeKind.END:
			_draw_stadium(r, col, text, focus)
		_:
			_draw_box(r, col, text, focus)

func _card_text(card_id: String) -> String:
	for card in config.get("cards", []):
		if str(card.get("id", "")) == card_id:
			return str(card.get("text", card_id))
	return card_id

func _draw_stadium(r: Rect2, col: Color, text: String, focus: bool) -> void:
	canvas.draw_rect(r, col, true)
	var rad := r.size.y * 0.5
	canvas.draw_circle(Vector2(r.position.x + rad, r.position.y + rad), rad, col)
	canvas.draw_circle(Vector2(r.end.x - rad, r.position.y + rad), rad, col)
	if focus:
		canvas.draw_rect(r.grow(3), COLOR_SLOT_FOCUS, false, 3.0)
	_draw_centered_text(r, text, Color(0.1, 0.2, 0.15))

func _draw_box(r: Rect2, col: Color, text: String, focus: bool) -> void:
	canvas.draw_rect(r, col, true)
	canvas.draw_rect(r, Color(0.2, 0.4, 0.6, 0.5), false, 2.0)
	if focus:
		canvas.draw_rect(r.grow(3), COLOR_SLOT_FOCUS, false, 3.0)
	_draw_centered_text(r, text, Color(0.1, 0.2, 0.3))

func _draw_diamond(r: Rect2, col: Color, text: String, focus: bool) -> void:
	var cx := r.position.x + r.size.x * 0.5
	var cy := r.position.y + r.size.y * 0.5
	var pts := PackedVector2Array([
		Vector2(cx, r.position.y), Vector2(r.end.x, cy),
		Vector2(cx, r.end.y), Vector2(r.position.x, cy),
	])
	canvas.draw_colored_polygon(pts, col)
	canvas.draw_polyline(pts + PackedVector2Array([pts[0]]), Color(0.1, 0.35, 0.55), 2.0, true)
	if focus:
		canvas.draw_rect(r.grow(4), COLOR_SLOT_FOCUS, false, 3.0)
	_draw_centered_text(r, text, Color(0.05, 0.15, 0.25))

func _draw_centered_text(r: Rect2, text: String, col: Color) -> void:
	var font: Font = ThemeDB.fallback_font
	var fs := 16
	if UiTheme and UiTheme.ui_font:
		font = UiTheme.ui_font
	var sz := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs)
	var pos := Vector2(r.position.x + (r.size.x - sz.x) * 0.5, r.position.y + (r.size.y + sz.y) * 0.5 - 4)
	canvas.draw_string(font, pos, text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)

func _draw_label_at(pos: Vector2, text: String, col: Color) -> void:
	var font: Font = ThemeDB.fallback_font
	var fs := 15
	if UiTheme and UiTheme.ui_font:
		font = UiTheme.ui_font
	canvas.draw_string(font, pos, text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)

func _draw_arrow_head(tip: Vector2, dir: Vector2, col: Color) -> void:
	var d := dir.normalized()
	var left := tip - d * 12 + d.orthogonal() * 7
	var right := tip - d * 12 - d.orthogonal() * 7
	canvas.draw_colored_polygon(PackedVector2Array([tip, left, right]), col)

func _find_node(id: String) -> Dictionary:
	for n in config.get("nodes", []):
		if str(n.get("id", "")) == id:
			return n
	return {}

func _draw_fixed_edge(edge: Dictionary) -> void:
	var a := _node_rect(_find_node(str(edge.get("from", ""))))
	var b := _node_rect(_find_node(str(edge.get("to", ""))))
	if a.size == Vector2.ZERO or b.size == Vector2.ZERO:
		return
	var start := Vector2(a.position.x + a.size.x * 0.5, a.end.y)
	var endp := Vector2(b.position.x + b.size.x * 0.5, b.position.y)
	canvas.draw_line(start, endp, COLOR_ARROW, 2.5)
	_draw_arrow_head(endp, Vector2.DOWN, COLOR_ARROW)

func _draw_handles() -> void:
	var decide := _find_node("decide")
	if decide.is_empty():
		return
	if not filled.has("decide") and _mode == "fill":
		return
	var r := _node_rect(decide)
	var yes_h := Rect2(r.position.x - 52, r.position.y + r.size.y * 0.5 - 16, 48, 32)
	var no_h := Rect2(r.end.x + 4, r.position.y + r.size.y * 0.5 - 16, 48, 32)
	_edge_hits["yes"] = yes_h
	_edge_hits["no"] = no_h
	var miss := _next_missing()
	var yes_col := COLOR_YES_EDGE if wires.has("yes") else (COLOR_SLOT_FOCUS if miss == "wire:yes" or _wire_from == "yes" else Color(0.7, 0.7, 0.75))
	var no_col := COLOR_ARROW if wires.has("no") else (COLOR_SLOT_FOCUS if miss == "wire:no" or _wire_from == "no" else Color(0.7, 0.7, 0.75))
	canvas.draw_rect(yes_h, yes_col, true)
	canvas.draw_rect(no_h, no_col, true)
	_draw_label_at(yes_h.position + Vector2(10, 22), "是", Color(0.1, 0.1, 0.1))
	_draw_label_at(no_h.position + Vector2(10, 22), "否", Color(0.95, 0.95, 1))

func _draw_wires() -> void:
	var decide := _find_node("decide")
	if decide.is_empty():
		return
	var a := _node_rect(decide)
	if wires.has("yes"):
		var tgt := _find_node(str(wires["yes"]))
		if not tgt.is_empty():
			var b := _node_rect(tgt)
			var start := Vector2(a.position.x, a.position.y + a.size.y * 0.5)
			var mid1 := Vector2(a.position.x - 56, start.y)
			var mid2 := Vector2(mid1.x, b.position.y + b.size.y * 0.5)
			var endp := Vector2(b.position.x, mid2.y)
			canvas.draw_line(start, mid1, COLOR_YES_EDGE, 3.0)
			canvas.draw_line(mid1, mid2, COLOR_YES_EDGE, 3.0)
			canvas.draw_line(mid2, endp, COLOR_YES_EDGE, 3.0)
			_draw_arrow_head(endp, Vector2.RIGHT, COLOR_YES_EDGE)
			_draw_label_at(Vector2(mid1.x - 22, (mid1.y + mid2.y) * 0.5), "是", COLOR_YES_EDGE)
	if wires.has("no"):
		var tgt2 := _find_node(str(wires["no"]))
		if not tgt2.is_empty():
			var b2 := _node_rect(tgt2)
			var start2 := Vector2(a.end.x, a.position.y + a.size.y * 0.5)
			var mid := Vector2(a.end.x + 44, start2.y)
			var midb := Vector2(mid.x, b2.position.y + 8)
			var endp2 := Vector2(b2.position.x + b2.size.x * 0.5, b2.position.y)
			canvas.draw_line(start2, mid, COLOR_ARROW, 2.5)
			canvas.draw_line(mid, midb, COLOR_ARROW, 2.5)
			canvas.draw_line(midb, endp2, COLOR_ARROW, 2.5)
			_draw_arrow_head(endp2, Vector2.DOWN, COLOR_ARROW)
			_draw_label_at(Vector2(mid.x + 4, mid.y - 10), "否", COLOR_ARROW)

func _draw_side_by_side() -> void:
	var left := Rect2(30, 20, 300, 280)
	var right := Rect2(370, 20, 300, 280)
	config["left_hit"] = left
	config["right_hit"] = right
	config["back_hit"] = Rect2(70, 100, 40, 100)
	canvas.draw_rect(left, Color("e5f2f8"), true)
	canvas.draw_rect(right, Color("e5f2f8"), true)
	if _pick_side == "loop":
		canvas.draw_rect(left.grow(2), COLOR_SLOT_FOCUS, false, 3.0)
	elif _pick_side == "branch":
		canvas.draw_rect(right.grow(2), COLOR_SLOT_FOCUS, false, 3.0)
	_draw_mini_loop(Vector2(80, 50), wires.has("yes"))
	_draw_mini_branch(Vector2(420, 50))
	_draw_label_at(Vector2(145, 270), "方案甲", Color("173a54"))
	_draw_label_at(Vector2(485, 270), "方案乙", Color("173a54"))

func _draw_mini_loop(origin: Vector2, back_on: bool) -> void:
	var start := Rect2(origin + Vector2(40, 0), Vector2(120, 28))
	var proc := Rect2(origin + Vector2(40, 50), Vector2(120, 28))
	var dec := Rect2(origin + Vector2(30, 100), Vector2(140, 56))
	_draw_stadium(start, COLOR_START, "到灯柱", false)
	canvas.draw_line(start.position + Vector2(60, 28), proc.position + Vector2(60, 0), COLOR_ARROW, 2)
	_draw_box(proc, COLOR_PROCESS, "观察灯色", false)
	canvas.draw_line(proc.position + Vector2(60, 28), dec.position + Vector2(70, 0), COLOR_ARROW, 2)
	_draw_diamond(dec, COLOR_DECISION, "绿灯未亮起？", false)
	var col := COLOR_YES_EDGE if back_on else COLOR_ARROW
	canvas.draw_line(dec.position + Vector2(0, 28), Vector2(origin.x + 10, origin.y + 128), col, 2.5)
	canvas.draw_line(Vector2(origin.x + 10, origin.y + 128), Vector2(origin.x + 10, origin.y + 64), col, 2.5)
	canvas.draw_line(Vector2(origin.x + 10, origin.y + 64), proc.position + Vector2(0, 14), col, 2.5)
	_draw_label_at(Vector2(origin.x + 12, origin.y + 90), "是", col)
	canvas.draw_line(dec.position + Vector2(140, 28), Vector2(origin.x + 200, origin.y + 128), COLOR_ARROW, 2)
	canvas.draw_line(Vector2(origin.x + 200, origin.y + 128), Vector2(origin.x + 200, origin.y + 160), COLOR_ARROW, 2)
	_draw_arrow_head(Vector2(origin.x + 200, origin.y + 160), Vector2.DOWN, COLOR_ARROW)
	_draw_label_at(Vector2(origin.x + 175, origin.y + 110), "否", COLOR_ARROW)
	_draw_stadium(Rect2(origin + Vector2(150, 160), Vector2(100, 28)), COLOR_START, "通行", false)

func _draw_mini_branch(origin: Vector2) -> void:
	var start := Rect2(origin + Vector2(40, 0), Vector2(120, 28))
	var dec := Rect2(origin + Vector2(30, 50), Vector2(140, 56))
	_draw_stadium(start, COLOR_START, "到路口", false)
	canvas.draw_line(start.position + Vector2(60, 28), dec.position + Vector2(70, 0), COLOR_ARROW, 2)
	_draw_diamond(dec, COLOR_DECISION, "有可用天桥？", false)
	var left := Rect2(origin + Vector2(0, 140), Vector2(100, 28))
	var right := Rect2(origin + Vector2(140, 140), Vector2(100, 28))
	canvas.draw_line(dec.position + Vector2(0, 28), left.position + Vector2(50, 0), COLOR_ARROW, 2)
	canvas.draw_line(dec.position + Vector2(140, 28), right.position + Vector2(50, 0), COLOR_ARROW, 2)
	_draw_box(left, COLOR_PROCESS, "走天桥", false)
	_draw_box(right, COLOR_PROCESS, "原地等灯", false)

# 两种信号情形均执行学生当前的条件与连线，最多走十二步。
func _run_crossing_case(result: Dictionary) -> void:
	_running = true
	undo_btn.disabled = true
	back_btn.disabled = true
	submit_btn.disabled = true
	var case_id := "green_at_start" if _case_results.is_empty() else "red_then_green"
	var trace: Array = []
	var current := "observe"
	var observations := 0
	var outcome := "step_limit"
	_sim_person = "等待"
	_sim_status = "开始时绿灯亮" if case_id == "green_at_start" else "先红灯，再变绿灯"
	for step in range(12):
		_sim_node = current
		# 模拟信号按时间步切换，不由观察次数触发。
		_sim_light = "green" if case_id == "green_at_start" or step >= 4 else "red"
		if current == "observe":
			observations += 1
			_sim_status = "第 %d 次观察：%s灯" % [observations, "绿" if _sim_light == "green" else "红"]
			trace.append({"node": "observe", "light": _sim_light})
			current = "decide"
		elif current == "decide":
			var condition := str(filled.get("decide", ""))
			var answer := false
			match condition:
				"cond_green_off": answer = _sim_light != "green"
				"cond_bridge": answer = false # 这一情形没有可用天桥
				"cond_count": answer = observations >= 3
				"cond_arrive": answer = false # 还在路口
				_:
					outcome = "not_a_condition"
					_sim_status = "这张卡不是可以回答是或否的问题"
			if outcome == "not_a_condition":
				trace.append({"node": "decide", "error": outcome})
				canvas.queue_redraw()
				await get_tree().create_timer(0.42).timeout
				break
			var branch := "yes" if answer else "no"
			current = str(wires.get(branch, ""))
			_sim_status = "判断结果：%s" % ("是" if answer else "否")
			trace.append({"node": "decide", "light": _sim_light, "answer": branch, "to": current})
		elif current == "cross":
			if _sim_light == "green":
				outcome = "crossed_green"
				_sim_person = "通过"
				_sim_status = "绿灯亮，行人安全通过"
			else:
				outcome = "red_blocked"
				_sim_person = "路沿停下"
				_sim_status = "红灯还亮着，行人在路沿停下"
			trace.append({"node": "cross", "light": _sim_light, "outcome": outcome})
			canvas.queue_redraw()
			await get_tree().create_timer(0.42).timeout
			break
		else:
			outcome = "wrong_destination"
			_sim_status = "流程没有走到观察或过马路"
			trace.append({"node": current, "outcome": outcome})
			canvas.queue_redraw()
			await get_tree().create_timer(0.42).timeout
			break
		canvas.queue_redraw()
		await get_tree().create_timer(0.42).timeout
	if outcome == "step_limit":
		_sim_status = "走了多步还没通过，看看箭头"
	var case_result := {"caseId": case_id, "outcome": outcome, "observations": observations, "trace": trace}
	_case_results.append(case_result)
	ClassroomBridge.report_evidence({
		"eventType": "case_run", "eventId": "s2_rewrite-run-%s-%s" % [Time.get_unix_time_from_system(), Time.get_ticks_usec()],
		"taskId": GameState.TASK_S2A, "correct": outcome == "crossed_green",
		"payload": {"conditionCardId": filled.get("decide", ""), "wires": wires.duplicate(), "case": case_result, "supportUsed": _support_used or int(GameState.fail_counts.get(GameState.TASK_S2A, 0)) > 0}
	})
	_running = false
	undo_btn.disabled = false
	back_btn.disabled = false
	submit_btn.disabled = false
	canvas.queue_redraw()
	if _case_results.size() < 2:
		submit_btn.text = "运行第二种情况"
		next_hint.text = "下一步：点「运行第二种情况」"
		feedback_label.text = _sim_status + "。再试另一种情况。"
		return
	var complete_ok := bool(result.get("ok", false))
	for item in _case_results:
		complete_ok = complete_ok and item.get("outcome") == "crossed_green"
	var attempt := {"filled": filled.duplicate(), "wires": wires.duplicate(), "caseResults": _case_results.duplicate(true), "correct": complete_ok}
	_attempt_history.append(attempt)
	result["caseResults"] = _case_results.duplicate(true)
	result["attemptHistory"] = _attempt_history.duplicate(true)
	result["supportUsed"] = _support_used or int(GameState.fail_counts.get(GameState.TASK_S2A, 0)) > 0
	result["lightReplay"] = "two_cases"
	if complete_ok:
		_locked = true
		feedback_label.text = "两种情况都试过了，行人安全通过。"
		submitted.emit(true, result)
	else:
		feedback_label.text = "两种情况已运行。看看结果，撤回后修改。"
		submitted.emit(false, result)

func _draw_crossing() -> void:
	var left := 30.0
	var road := Rect2(left, 20, 330, 220)
	var background_path := "res://assets/sprites/scenes/crossing_redesign.png"
	if _crossing_background == null and ResourceLoader.exists(background_path):
		_crossing_background = load(background_path) as Texture2D
	if _crossing_background != null:
		canvas.draw_texture_rect(_crossing_background, road, false)
	else:
		canvas.draw_rect(road, Color("d9eef0"))
		canvas.draw_rect(Rect2(left + 130, 20, 70, 220), Color("597581"))
		for i in range(5):
			canvas.draw_rect(Rect2(left + 130, 150 + i * 12, 70, 6), Color("f8fafc"))
	canvas.draw_rect(Rect2(left + 70, 115, 25, 54), Color("263b48"))
	canvas.draw_circle(Vector2(left + 82, 129), 8, Color("ef4444") if _sim_light == "red" else Color("683a3a"))
	canvas.draw_circle(Vector2(left + 82, 155), 8, Color("35c777") if _sim_light == "green" else Color("315a45"))
	var person_x := 110.0 if _sim_person != "通过" else 217.0
	canvas.draw_circle(Vector2(left + person_x, 169), 9, Color("f1b782"))
	canvas.draw_rect(Rect2(left + person_x - 9, 178, 18, 21), Color("f59e0b"))
	_draw_label_at(Vector2(left + 8, 260), _sim_status, Color("173a54"))

func _draw_kettle_edges() -> void:
	# “是”进入加热并回到读取；“否”向下结束。
	canvas.draw_line(Vector2(220, 128), Vector2(175, 128), COLOR_ARROW, 2.5)
	_draw_arrow_head(Vector2(175, 128), Vector2.LEFT, COLOR_ARROW)
	var points := PackedVector2Array([Vector2(100, 110), Vector2(100, 63), Vector2(245, 63)])
	canvas.draw_polyline(points, COLOR_ARROW, 2.5, true)
	_draw_arrow_head(Vector2(245, 63), Vector2.RIGHT, COLOR_ARROW)
	_draw_label_at(Vector2(180, 120), "是", Color("173a54"))
	_draw_label_at(Vector2(340, 186), "否", Color("173a54"))

# 热水壶采用固定教材流程；学生认读图并观察两种起始水温。
func _run_kettle_case(result: Dictionary) -> void:
	_running = true
	undo_btn.disabled = true
	back_btn.disabled = true
	submit_btn.disabled = true
	var initial := 80 if _case_results.is_empty() else 100
	var water := initial
	var trace: Array = []
	_kettle_temperature = water
	_kettle_heating = false
	for round_index in range(3):
		_sim_node = "check"
		_kettle_status = "读取水温：%d℃" % water
		trace.append({"node": "check", "temperature": water})
		canvas.queue_redraw()
		await get_tree().create_timer(0.42).timeout
		_sim_node = "decide"
		var needs_heat := water < 100
		_kettle_status = "低于100℃？%s" % ("是" if needs_heat else "否")
		trace.append({"node": "decide", "temperature": water, "answer": needs_heat})
		canvas.queue_redraw()
		await get_tree().create_timer(0.42).timeout
		if not needs_heat:
			_sim_node = "stop"
			_kettle_heating = false
			_kettle_status = "已达到100℃，停止加热"
			trace.append({"node": "stop", "temperature": water})
			canvas.queue_redraw()
			await get_tree().create_timer(0.42).timeout
			break
		_sim_node = "heat"
		_kettle_heating = true
		_kettle_status = "继续加热（模拟）"
		trace.append({"node": "heat", "temperature": water})
		canvas.queue_redraw()
		await get_tree().create_timer(0.42).timeout
		water = mini(100, water + 10)
		_kettle_temperature = water
		_kettle_heating = false
	var case_result := {"initialTemperature": initial, "finalTemperature": water, "trace": trace}
	_case_results.append(case_result)
	ClassroomBridge.report_evidence({
		"eventType": "case_run", "eventId": "s2_kettle-run-%s-%s" % [Time.get_unix_time_from_system(), Time.get_ticks_usec()],
		"taskId": GameState.TASK_S2C, "correct": bool(result.get("ok", false)),
		"payload": {"filled": filled.duplicate(), "case": case_result, "supportUsed": _support_used or int(GameState.fail_counts.get(GameState.TASK_S2C, 0)) > 0}
	})
	_running = false
	undo_btn.disabled = false
	back_btn.disabled = false
	submit_btn.disabled = false
	canvas.queue_redraw()
	if _case_results.size() < 2:
		submit_btn.text = "运行100℃"
		next_hint.text = "下一步：点「运行100℃」"
		feedback_label.text = "80℃的情况已模拟，再试100℃。"
		return
	var complete_ok := bool(result.get("ok", false))
	_attempt_history.append({"filled": filled.duplicate(), "caseResults": _case_results.duplicate(true), "correct": complete_ok})
	result["caseResults"] = _case_results.duplicate(true)
	result["attemptHistory"] = _attempt_history.duplicate(true)
	result["supportUsed"] = _support_used or int(GameState.fail_counts.get(GameState.TASK_S2C, 0)) > 0
	if complete_ok:
		_locked = true
		feedback_label.text = "两种水温都已模拟。"
		submitted.emit(true, result)
	else:
		feedback_label.text = "两种水温已模拟，再对照流程修改。"
		submitted.emit(false, result)

func _draw_kettle_simulation() -> void:
	var panel := Rect2(785, 20, 225, 245)
	canvas.draw_rect(panel, Color("e5f2f8"), true)
	canvas.draw_rect(Rect2(845, 72, 100, 120), Color("d3e6ec"), true)
	canvas.draw_rect(Rect2(852, 145, 86, 40), Color("7ec4e1"), true)
	canvas.draw_rect(Rect2(837, 63, 116, 10), Color("456775"), true)
	canvas.draw_arc(Vector2(945, 124), 30, -PI/2, PI/2, 16, Color("456775"), 5)
	if _kettle_heating:
		canvas.draw_circle(Vector2(873, 205), 6, Color("f97316"))
		canvas.draw_circle(Vector2(895, 205), 7, Color("f97316"))
		canvas.draw_circle(Vector2(917, 205), 6, Color("f97316"))
	_draw_label_at(Vector2(859, 125), "%d℃" % _kettle_temperature, Color("173a54"))
	_draw_label_at(Vector2(800, 239), _kettle_status, Color("173a54"))
	_draw_label_at(Vector2(800, 41), "水温模拟", Color("173a54"))
