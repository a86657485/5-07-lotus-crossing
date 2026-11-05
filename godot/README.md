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
变体：无线程 Web（`variant/thread_support=false`）。当前模板的安全上下文要求见下节。

## 2026-11-05 运行边界与回归

当前 4.7.2 官方导出模板在关闭线程后仍检查 Secure Context，音频初始化也依赖 AudioWorklet。真实 Chrome 在普通 LAN IP 的明文 HTTP 下拒绝启动。localhost 可运行；跨设备 Godot 需要整个壳及 iframe 使用浏览器信任的 HTTPS，本轮未做该验收。普通 LAN HTTP 由既有 Studio 三站探究组件承接，不修改 Godot 启动检查来绕过平台限制。

当前导出需同步桥脚本（仅执行 Godot 导出不会复制自定义 JS）：

```bash
godot --headless --path godot/project --export-release Web ../export/web/index.html
cp godot/bridge/classroom_bridge.js godot/export/web/classroom_bridge.js
cp -R godot/export/web/. public/godot/
```

正确的当前回归入口：

```bash
node --test godot/bridge/classroom_bridge.test.cjs
godot --headless --path godot/project --script res://scripts/tools/bridge_regression.gd
godot --headless --path godot/project --script res://scripts/tools/smoke_playthrough.gd
```

主脚本原有 `--smoke` 分支仍使用旧站点 API；独立工具已适配当前流程图场景。桥回归除 JSON 解码外，还执行 GDScript 中实际的 JS 回调注册表达式。实际 Web 验证已覆盖父壳会话进入 Godot，以及 S1 原始 E1 的 studentId/classId/runId 与流程图选择上报。
