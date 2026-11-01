# AI 生图层（v1.1）｜方案 A 橙马甲

依据 Mood Board（`../moodboard/`）＋`04_GodotRPG美术补丁.md` 生图；洋红底已抠透。  
**禁岛／禁挡脸黄圈**已在提示词约束。未写前端。

## 可进工程文件

| 文件 | 用途 |
| --- | --- |
| `characters/player_4dir_sheet.png` | 四向合图（抠透） |
| `characters/player_{down,left,right,up}.png` | 单帧；顺序按 sheet 左→右：下／左／右／上 |
| `characters/alian_front.png` | 阿莲／志愿者（持平板）立绘精灵 |
| `scenes/street_hub_bg.png` | 路口一屏街景底图 1280×720 |
| `props/signal_prop.png` | 信号灯柱道具 |
| `fx/focus_ring.png` | 脚底半透明琥珀环＋侧箭头（无挡脸） |

`_raw_*.jpg` 为未抠底原稿，可留档。

## 与色块层关系

- 根目录 `characters/`／`tiles/`／`fx/` 仍是程序色块占位（轻量）
- 本 `ai/` 目录为 **生图升级**；嵌工程时优先替换同名用途资源
- FocusRing 仍禁止实心黄圈挡脸；环只在脚下

## 版本

`g5l7-godot-art-pack-v1.1-ai`｜2026-11-01 Asia/Shanghai｜美术风格
