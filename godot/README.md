# Godot 4 HTML5｜五年级第7课 RPG 主玩法

情境真相源：`design/02_RPG重做_Godot方案.md`（仓库内副本）。

## 目录
```
godot/
  project/           # Godot 4.7.2 工程
  export/web/        # HTML5 导出（嵌入 public/godot/）
  bridge/classroom_bridge.js
  CREDITS.md
```

## 桥事件（window.G5L7Classroom）
见设计 §6.2：`app:session` / `station:unlock` / `gate:state` / `evidence:report` /
`relic:use|sync` / `exam:open` / `story:replay` / `flow:*` / `station:reset|focus`

## 本地导出
```bash
godot --headless --path godot/project --export-release Web godot/export/web/index.html
cp -R godot/export/web/* public/godot/
```
变体：无线程 Web（`variant/thread_support=false`）以兼容课堂 HTTP。
