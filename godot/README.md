# Godot 4 HTML5 桥接（Phase B）

本课**主探究**仍由 Studio Web 三站承担。Godot 工程是课堂嵌入向的桥接增强：三站入口面板 + `JavaScriptBridge` 上报，**不重写** Web 玩法。

## 目录

```
godot/
  README.md
  bridge/classroom_bridge.js   ← window.G5L7Classroom
  project/                     ← Godot 4.7 工程（可编辑 / 可导出）
  export/web/                  ← CLI HTML5 导出产物
public/godot/                  ← 同步副本，供课堂服务 /godot/ 嵌入
```

## 环境

- Godot：`/opt/homebrew/bin/godot`（已测 4.7.2.stable）
- 需已安装对应版本 **Web** export templates

## 本地打开工程

```bash
cd "/Users/jun/Desktop/2026-2027教学备课/五年级 身边的算法/按课拆分/第7课 重复操作用循环/莲花山智慧路口"
godot --path godot/project
# 或编辑器：Godot → 导入 godot/project/project.godot
```

非 Web 运行时走本地降级：点「完成并上报」会提示「非 Web 导出，跳过上报」，三站仍可点完演示。

## CLI 导出 HTML5

```bash
mkdir -p godot/export/web
godot --headless --path godot/project --export-release "Web" "../export/web/index.html"
# 同步到课堂 public（含 bridge）
rm -rf public/godot && mkdir -p public/godot
cp -R godot/export/web/. public/godot/
cp godot/bridge/classroom_bridge.js public/godot/classroom_bridge.js
# 确保 public/godot/index.html 含 <script src="classroom_bridge.js"></script>
```

## 桥接口 `window.G5L7Classroom`

| 方法 | 说明 |
| --- | --- |
| `setContext(student, progress)` | 课堂壳登录后写入 localStorage |
| `getStudent()` / `getProgress()` | 同步读缓存 |
| `refreshProgress()` | `GET /api/state` |
| `reportStation(taskId, payload)` | `POST /api/progress`（s1/s2/s3 → 对应 stations） |
| `useRelic()` | `POST /api/relic`（配额仍由服务端锁 3） |
| `onExamOpen(cb)` | 三站齐后可选回调 |

## 课堂嵌入

1. 根 `index.html` 已挂 `/godot/classroom_bridge.js`
2. 地图 HUD「Godot 试验台」→ iframe `/godot/index.html?studentId=…`
3. 直链：`http://localhost:8797/godot/`（先 `npm run build && DATA_DIR=… PORT=8797 npm start`）
4. **不要**把 Godot 试验台当成正式三站主路径

## 红线

- 不改题库答案 / 达标线 / 法宝配额 3；不碰端口 8766
- 老师同意前不合并 main
