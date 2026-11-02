# 五年级第7课｜Godot 最小美术占位升级包 v1

- 依据：`04_GodotRPG美术补丁.md`｜角色方案 **A**（Q 版二头身＋橙马甲）
- 用途：替换色块原型，可直接拖进 Godot 4 工程；**非最终精模**
- 不做：不写前端／GDScript；Mood Board 仅作生图与定妆参考

## 目录

| 路径 | 内容 |
| --- | --- |
| `characters/` | 玩家四向单帧＋横版 sheet；阿莲三向＋半身；路口领队单向下 |
| `props/` | 信号灯四态＋sheet；保温壶；调度亭屏 |
| `tiles/` | 沥青／斑马线／路缘 64×64 |
| `fx/` | FocusRing 脚底半透明琥珀椭圆＋侧箭头；pulse 三帧 |
| `moodboard/` | 意向图 3 张（总览／角色焦点／S2 灯＋回边） |

## Godot 接入要点

1. **玩家**：`player_4dir_sheet.png`，单元格 **96×96**，顺序 **下→左→右→上**（也可用 `player_*.png` 单帧）。
2. **阿莲**：地图用 `alian_down/left/right`；对白用 `alian_portrait`。
3. **灯柱**：`signal_*.png` 切 AnimationPlayer，或 sheet 四格 48×96。
4. **FocusRing**：挂角色脚底 `Node2D`；禁实心黄圈挡脸；侧箭头在环外。
5. **瓦片**：`TileSet` 导入 `asphalt_tile`／`zebra_tile`／`curb_tile`。
6. **Mood Board**：只作美术参考，文案勿烧进场景唯一 UI。

## 色板（与 04 一致）

橙马甲 `#F97316`｜反光条 `#FDE68A`｜焦点琥珀 `#F59E0B`｜沥青 `#4B5563`｜天空 `#7EC8FF`

## 版本

`g5l7-godot-art-pack-v1`｜美术风格｜2026-11-01 Asia/Shanghai
