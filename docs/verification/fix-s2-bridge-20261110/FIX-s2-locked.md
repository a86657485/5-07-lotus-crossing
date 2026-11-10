# FIX：引导台完成后第二站进不去（完成证据被桥接吞掉）

日期：2026-11-10　影响版本：本机课堂 8797 当前构建（bundle `index-DLzUmM0u.js`）

## 现象

学生做引导台（S1）并点「完成引导台」后：

- 当场还能看到"接对了"的对白，底部「前往拆解台」短暂亮起；
- 一旦刷新页面／换节课重新进，底部「前往拆解台」变灰且**文字与底色同色、几乎看不见**，点了没有任何反应；
- 服务端进度一直是 `s2_rewrite=false`，教师大屏也看不到该生完成引导台。

统计当天库内数据：**34 人**两种信号灯情形都已跑通（等价于已过关），但 `stations.s2_rewrite` 仍为 false（其中 28 人为名单学生）。

## 根因

`public/godot/classroom_bridge.js` 用布尔 `receivingHostMessage` 作为回声保护：

```js
emit(ev, data) {
  if (!receivingHostMessage && ...) postMessage(...)   // 一律拦截
}
```

而 Godot 的 `JavaScriptBridge` 回调是**同步**执行的：宿主下发 `flow:result`（学生点「完成」）时，GDScript 仍在同一个 JS 调用栈里执行 `_on_s1_done()` → `report_evidence()` / `emit_to_js("station:unlock")`。此时 `receivingHostMessage` 仍为 true，于是：

| 事件 | 发出方 | 结果 |
|---|---|---|
| `evidence:report`（完成证据，约 2.4 KB） | `_on_s1_done` / `_on_s2b_done` / `_on_s2c_done` / `_on_s3_done` | 被吞 → 服务端不记录 |
| `station:unlock`（解锁下一站） | 同 | 被吞 |
| `progress:s3Detail` | `_on_s3_done` | 被吞 |
| Godot 本地 `GameState` | — | 正常置 true（所以当场"看起来"通过） |

只有点击类操作（`flow:open`、中途 `case_run`）不在宿主回调栈里，才能正常上报，所以页面内的过程性证据都在，唯独"完成"这一步丢失。

## 改动

只改一个静态文件，**不需要重新导出 Godot 包**：

`public/godot/classroom_bridge.js`（`dist/godot/classroom_bridge.js` 同步镜像）

- 回声保护由"全局布尔"改为"**同名事件**才拦截"：`hostEventName` + `hostDepth` 深度计数；
- 宿主回调栈内产生的**其它事件**先入 `pendingOut`，等 `finally` 里深度归零后按序补发；
- `app:session`、`relic:sync` 等同名回声行为不变（不会自激）。

## 验证（本机 8797 · Chromium 1280×720）

| 项 | 修复前 | 修复后 |
|---|---|---|
| 父页收到完成证据 `evidence:report` | 无 | `evidence:report`（2463 B） |
| `POST /api/evidence` 完成报文 | 无 | 200（2563 B） |
| 服务端 `stations` | `s2_rewrite:false` | `s1_order:true / s2_rewrite:true`，法宝"哨"解锁 |
| 重新登录后点「前往拆解台」 | 无反应、任务条退回"先去引导台" | 弹出先学卡·信号循环，任务条"前往拆解台，分清『再等』和『选路』" |
| 站内面板 | — | 依次 引导台 → 信号拆解台 → 热水壶 → 调度台 可达 |

自测：`node --test godot/bridge/classroom_bridge.test.cjs` 2/2 通过；`node --test server.test.cjs` 19/19 通过。

## 存量数据处理（已执行 · 方案 B）

老师确认按方案 B 批量补记，**仅补「引导台已完成」这一层，不臆造第二/三站**。

- 工具：`tools/repair-s2-unlock.py`（默认只演练，`--apply` 才写库；`--include-manual` 才含测试账号）
- 判定口径：`stations.s2_rewrite` 仍为 false，且证据中 `s2_rewrite/case_run/correct=true` 同时覆盖 `green_at_start` 与 `red_then_green`
- 写入内容：`stations.s1_order=true`、`stations.s2_rewrite=true`；按 `stationsOk` 重算法宝（哨=通过引导台）；`stateVersion+1`；追加 `repairNote` 便于回溯
- 备份：`../_runtime备份/runtime-20261110-1613/`（VACUUM INTO 快照 + 原始 wal/shm；备份时 224 学生 / 59 状态 / 3834 证据，integrity ok）
- 执行结果：**503 班 28 人**补记成功（代佳蕊、何仁东、余亦城、余紫墨、刘倩秀、刘宸恺、刘语柏、周沐阳、宋嘉诚、廖烁乔、张可儿、朱其姝、李沐阳、李瑾儿、杨萧衍、林嘉远、汪子莘、温念恩、潘伟瑞、熊骏天、王梓祐、赖荣锐、赵哈斯、钟萱茹、陈佳祺、陈俊陶、项天琪、龙语心）；另 6 个 `复现*` 测试账号一并补记用于复核
- 校验：`pragma integrity_check=ok`；59 条状态中 29 条已解锁第二站；哨法宝缺失 0
- 界面复核：被锁账号重新登录 → 点「前往拆解台」→ 先学卡弹出 → 进入「信号拆解台·哪张图会让某一步再做一次？」面板

注意：补记只改进度，不伪造学习证据；这 28 人的 `evidenceHistory` 里仍无 `evidence_lock`，教师大屏"通关证据"一栏对引导台可能仍显示缺记录，属预期。

