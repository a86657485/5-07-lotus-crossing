# Phase B 整合自测报告 · Godot 4 HTML5 桥

- 日期：2026-11-01（Asia/Shanghai）
- 执行：Grok Bot（老师 Mac，`machineId` 指定工作目录）
- 分支：`codex/g5l7-integrate`（续 Phase A `ab651f6`）

## Godot 版本与导出

| 项 | 结果 |
| --- | --- |
| CLI | `/opt/homebrew/bin/godot` → **4.7.2.stable.official** |
| Export templates | `~/Library/Application Support/Godot/export_templates/4.7.2.stable` 含 web_* |
| 导出命令 | `godot --headless --path godot/project --export-release "Web" "../export/web/index.html"` |
| 导出结果 | **成功** → `godot/export/web/`（含 `index.html` / `.js` / `.pck` / `.wasm` ≈39MB） |
| 同步 | 已复制到 `public/godot/`，并注入 `classroom_bridge.js` |

## 交付清单

- `godot/bridge/classroom_bridge.js` — 完整 `G5L7Classroom`
- `godot/project/` — `project.godot` + `scenes/main.tscn` + `scripts/*.gd` + `export_presets.cfg`
- `godot/export/web/` + `public/godot/` — HTML5 产物
- 课堂壳：`index.html` 挂桥；地图「Godot 试验台」；`GodotLabView` iframe；`server.cjs` 增 `.wasm` mime
- 文档：本文件 + 更新 `godot/README.md`

## 启动 / 验证

```bash
cd "/Users/jun/Desktop/2026-2027教学备课/五年级 身边的算法/按课拆分/第7课 重复操作用循环/莲花山智慧路口"

# 编辑器打开
godot --path godot/project

# 课堂服务嵌入
npm run build
DATA_DIR="$PWD/.data-test" PORT=8797 npm start
# 学生端登录后地图点「Godot 试验台」
# 或直开 http://localhost:8797/godot/
```

### 已测

- Godot CLI import + `--export-release Web` 成功
- 工程文件与 bridge 脚本落盘
- `tsc` / 最小壳接线（见提交前 lint）

### 未测 / 阻塞

- 未在浏览器内完整手点 Godot 三站 → `POST /api/progress` 联调（需登录态 + 服务）
- 未测多机课堂彩排；未碰 8766
- `.wasm` 约 39MB，克隆/推送体积偏大（未用 Git LFS）

## 与 Phase A 关系

- Studio Web 三站仍是主探究；Godot 为可选桥接增强
- 法宝配额 / 达标线 / 题库未改

## 顺手观察（未修）

主代理反馈：学生完成第 1 站后教师大屏 S1 仍「尚无证据」。粗看 `App.handleCompleteStation1` 会 `persist({ stations, relics })` → `POST /api/progress`；若 L5 手点已过但大屏无证据，更像是**该次 persist 未成功/未带上 s1_order**或教师聚合读到旧 state，而非 Godot 侧问题。Phase B **未大修** Web 同步，留给主代理继续查。
