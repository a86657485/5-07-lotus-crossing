# Godot RPG 重做实现报告（g5l7）

- 分支：`godot/g5l7-rpg`
- 日期：2026-11-01 Asia/Shanghai
- 实现：Grok Bot 直承（禁 Studio/gemini4）

## 本轮补强（中文字体 + 可玩自测）
- 嵌入 **Noto Sans CJK SC**（`godot/project/assets/fonts/NotoSansSC-Regular.ttf`）全局 Theme
- 重导出 HTML5 → `godot/export/web/` → `public/godot/`（`index.pck` ≈15MB 含字体）
- headless `--smoke` 三站自动通关 `ok=true font=true`
- Web：登录壳 + `/godot/` 嵌入；浏览器截图中文可读

## 启动
```bash
cd lotus
npm run build
PORT=8797 DATA_DIR=.data-test npm start
# 学生 / ；教师 /teacher ；勿占 8766
```

## 截图
- `docs/screenshots/01_intro_cn.png` — 开场中文对白
- `docs/screenshots/02_s1_station.png` — S1 步骤排序面板
- `docs/screenshots/03_web_godot_direct.png` — 浏览器直接打开 Godot HTML5
- `docs/screenshots/04_login_to_godot.png` — 登录后进入 Godot 壳

## L 层
| 层 | 状态 |
| --- | --- |
| L1 | 已对照设计 |
| L2 | headless smoke + 导出通过 |
| L3 | tsc / 构建通过 |
| L4 | 浏览器登录→Godot 画布加载+中文截图；站内点击未在浏览器逐关手点（逻辑已 headless 通关） |
| L5 | 未测真课堂 |
| L6 | 未测 |

## 2026-11-01 剧情加厚（02b）
- 已按 `design/02b_剧情加厚_人物事件地点.md` 替换开场／进站三问／站间钩子／出口人物句；机制与 taskId 零改。
- 截图：`docs/screenshots/05_story_intro_02b.png`、`06_story_s1_enter_02b.png`
- headless smoke：全站 ok；已重导出 `public/godot/`。

## 2026-11-01 课堂可视占位（04 美术补丁）
- 沥青路＋斑马线＋R/Y/G 灯柱；HUB/S1/S2/S3 分区强调色；Q版橙马甲二头身（玩家／阿莲略高／领队黄帽）；FocusRing 脚底琥珀椭圆＋侧箭头。
- 开场世界反馈：人流微颤／乱穿抬脚／时长屏闪红。
- 预留 `godot/project/assets/sprites/`（README 可替换路径）。
- 截图：`docs/screenshots/07_visual_hub.png`、`08_s1_play.png`；smoke ok；中文字体仍嵌入。

## 2026-11-01 art-pack-v1 接入
- 源：`design/godot-art-pack-v1/` → `godot/project/assets/sprites/`（玩家四向／阿莲／领队／灯柱／沥青斑马／FocusRing／壶／调度亭）
- Mood Board 备查同步 `lotus/design/godot-art-pack-v1/moodboard/`
- 截图已更新：`docs/screenshots/07_visual_hub.png`、`08_s1_play.png`
- smoke ok；HTML5 已重导出 `public/godot/`
