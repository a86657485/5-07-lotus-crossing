# CREDITS｜五年级第7课 Godot RPG

## 本课定制
- 情境、关卡、对白、色块占位角色与地图：本课备课团队定制（莲花山智慧路口·临时小交警）
- Godot 工程与 `JavaScriptBridge` 课堂桥：本课实现（分支 `godot/g5l7-rpg`）

## 引擎与许可
- Godot Engine 4.7.2 — MIT License（https://godotengine.org）
- 网页流程图：React Flow / `@xyflow/react` 12.12.1，MIT，https://github.com/xyflow/xyflow；许可副本随网页保存在 `public/lesson/ReactFlow-LICENSE.txt`。
- Blockly Games Maze 与 Botbright 用于交互机制参考：运行规则观察角色、逐步执行、暂停重试、变条件迁移。本次未复制这两个项目的源码、人物、关卡或音频。
- `public/lesson/textbook-s1.png`、`textbook-s2.png`、`textbook-s3.png`：用户提供的本课教材第41–43页课堂引用片段，仅供本地本课教学使用；不将教材内容声明为本项目开源素材。

## 外引素材
- 当前 MVP 使用 ColorRect／程序化色块占位，**未引入** Kenney 等外部图集。
- 若后续换用 CC0 瓦片／精灵，须在本文件增补来源、许可与使用文件列表。

## 字体
- **Noto Sans CJK SC**（`assets/fonts/NotoSansSC-Regular.ttf`，自 NotoSansCJK-Regular.ttc 提取 SC 字面）— SIL Open Font License 1.1  
  来源：Google Noto CJK / `/usr/share/fonts/opentype/noto/`  
- 另附课文用字子集 `NotoSansSC-Lesson.ttf`（同许可）作瘦身备选。

## Art
- g5l7-godot-art-pack-v1（方案 A 橙马甲占位升级包，本课定制）
- `project/assets/sprites/scenes/crossing_redesign.png`：2026-11-04 使用本会话图像生成工具，以原开场剧情图作风格参考生成的新路口背景；不含文字、流程答案、人物或车辆。原六张 `assets/story/` 剧情图保留。本图不是 GitHub 参考项目的素材，未据此授予额外开源许可。
