# Godot RPG 重做实现报告（g5l7）

- 分支：`godot/g5l7-rpg`
- 日期：2026-11-01 Asia/Shanghai
- 实现：Grok Bot 直承（禁 Studio/gemini4，未派 Cursor 云端）

## 已实现（MVP 正路径）
- Godot 4.7.2 工程 `godot/project/`：World 一图三工位色块、Player+FocusRing、NPC 阿莲、TeleportButtons
- UI：任务条、法宝 HUD、先学卡、剧情回放（二刷可关）、重做本关
- Bridge：`ClassroomBridge` ↔ `window.G5L7Classroom`（§6.2 事件）+ iframe postMessage
- S1 `s1_order`：步骤点选排序＋标等待步＋错序行人后果＋⌫
- S2-A `s2_rewrite`：菱形/矩形/回边＋灯态回放
- S2-B `s2_vs_branch`：并排意图屏
- S2-C `s2_kettle`：三标签（禁「循环体」）
- S3 `s3_timing`：布置≠运行；faultObserved→策略/理由→revalidateOk；三态 gate
- 站序 S1→S2→S3→exam；开场五段可跳过/重播
- Web 壳：登录/名单/teacher/考核仍 Web；主玩法 iframe 嵌入 `public/godot/`
- HTML5 导出成功（无线程），已复制到 `public/godot/`
- 设计副本：`design/02_RPG重做_Godot方案.md`、`design/04_GodotRPG美术补丁.md`

## 未做／弱化
- 精美精灵／瓦片（色块占位）
- 选做 E6 空调、奖励小游戏 Godot 化（仍用原 Web RewardLoopGame）
- 浏览器内完整点通 L4/L5（需人工机房）
- 天桥支线（设计明确不做）

## 本地启动（PORT 8797）
```bash
cd lotus
PORT=8797 DATA_DIR=.data-test npm start
# 另开：npm run build && 由 server 托管 dist；或开发态按 README
```
服务端默认 8797；勿占 8766。

## L 层自检
| 层 | 状态 |
| --- | --- |
| L1 设计对齐 | 已对照 02/04 taskId／站序／禁 popup_quiz |
| L2 工程可运行 | headless 主场景通过；Web 导出成功 |
| L3 静态／类型 | 见当次 tsc |
| L4 浏览器主路径 | 未完整实测（导出已嵌入） |
| L5 真名单课堂 | 未测 |
| L6 独立审查评分 | 未测 |
