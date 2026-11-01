# Godot 4 HTML5 桥接脚手架（Phase B）

本课探究玩法目前由 Studio Web 壳承担。Godot 4 导出为后续增强，**不要**为赶工重写整套 Web 玩法。

## 目录约定

```
godot/
  README.md              ← 本文件
  project/               ← Godot 4 工程根（后续）
  export/web/            ← HTML5 导出产物（嵌入 public/godot/）
  bridge/
    classroom_bridge.js  ← JS 侧适配（草稿）
```

## JavaScriptBridge 接口草稿

Godot（GDScript）通过 `JavaScriptBridge` 调用页面注入的 `window.G5L7Classroom`：

| 方法 | 方向 | 说明 |
| --- | --- | --- |
| `getStudent()` | Godot→Web | 返回当前登录 `{ studentId, classId, name }` |
| `getProgress()` | Godot→Web | 返回三站进度 / 法宝剩余 |
| `reportStation(taskId, payload)` | Godot→Web | 上报站内证据；Web 再 `POST /api/progress` |
| `useRelic()` | Godot→Web | 消耗法宝；Web 调 `POST /api/relic` |
| `onExamOpen(cb)` | Web→Godot | 三站通过后通知可考 |

嵌入方式：课堂 `index` 在登录后按需 `iframe`/`<div id="godot-host">` 加载 `export/web/index.html`，并注入桥对象。法宝配额仍以服务端为准（整课 3 次）。
