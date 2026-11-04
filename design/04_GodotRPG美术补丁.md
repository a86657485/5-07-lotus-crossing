# 五年级第7课｜Godot RPG 美术补丁（04 补）

- 角色：美术风格｜协调：五年级备课团队｜2026-11-01（Asia/Shanghai）
- 上位：`04_美术风格规格.md`（v1.1，角色锁 **方案 A**）｜情境：`02_情境方案_莲花山小交警.md`
- 引擎：**Godot 4** 2D RPG（弃用 Studio 壳）；本文件只补 **可进工程的短规格**
- 范围：剪影配色／一屏地图分区／资产清单（可色块占位）／Mood Board≤3 条；**不出批量图、不开 Studio、不写前端**

---

## 1. 角色剪影与配色（方案 A 锁定）

统一：**Q 版二头身**（头≈身长）、短肢圆手、圆眼大瞳、轮廓清晰可剪影识别；服装服务「临时小交警／路口开放日」，与第6课园区巡检 **换装不换比例**。

### 1.1 玩家（临时小交警助手）

| 项 | 规格 |
| --- | --- |
| 剪影 | 大头短身；站姿略前倾；头顶不戴大檐帽（避挡对话气泡）；手可持小哨／空拳 |
| 配色 | 浅蓝／白短袖校服底 `#E0F2FE`／`#F8FAFC`；**橙马甲** `#F97316`＋反光条 `#FDE68A`；深灰短裤 `#374151`；运动鞋深色＋白边 |
| 精灵 | **四向** idle＋walk（最少）；可选 talk 口型 1–2 帧；单帧立绘仅对话用 |
| 名牌 | 不飘头顶；需要时贴 **胸前马甲** 或脚侧小条 |

### 1.2 阿莲（常驻 NPC · 成年志愿者）

| 项 | 规格 |
| --- | --- |
| 剪影 | 同二头身比例但 **肩略宽、身高略高半头**（可读「大人」）；微笑；一手平板／任务单 |
| 配色 | 同系 **橙马甲**＋反光条；内搭白／浅灰；深色长裤；发色深棕／黑，短扎发或利落短发（投影清晰） |
| 精灵 | 地图：**下／左／右** 三向即可（常站工位）；对话：**半身立绘** 一版＋轻口型 |
| 名牌 | **贴底座旁或胸前**；禁飘屋顶、禁与灯柱互挡 |

### 1.3 路口领队（轻量 NPC · 可简化）

| 项 | 规格 |
| --- | --- |
| 职责 | 开场／S3 一句指引即可；可与「调度亭值班」同人 |
| 剪影 | 二头身；戴 **简小黄安全帽** 或反光臂章（与玩家马甲区分：有帽／有臂章） |
| 配色 | 马甲同橙；内搭深蓝 `#1E3A5F`；安全帽 `#FBBF24` |
| 精灵 | **单向下 idle** 即可；对话复用阿莲面板换立绘亦可（赶工） |

### 1.4 FocusRing（硬规则，沿用 04／第6课）

| ✅ | ❌ |
| --- | --- |
| 脚底 **半透明琥珀椭圆** 脉冲环（`#F59E0B` α≈0.35–0.55） | 实心黄圈挡脸／挡躯干 |
| 环 **外侧** 一侧小箭头指向下一操作 | 「黄柱子」终态占位当唯一通关反馈 |
| 同一时刻全屏 **仅一处** 焦点环 | 多角色同时亮环抢焦 |

Godot 建议：`FocusRing` 作 `Node2D` 子节点挂角色脚底；`AnimationPlayer` 做 scale 呼吸；箭头用独立 `Sprite2D`／`Polygon2D`。

---

## 2. 一屏地图分区（顶视或斜 45°）

**相机**：优先 **斜 45°（3/4）** 街景可读斑马线与灯面；若瓦片更省则 **纯顶视** 亦可，但斑马线／灯箱须一眼可辨。  
**原则**：**一屏三站＋中枢**，少跑图；站距短，可用「前往××台」一键位移（过场≤0.5s）。

```
        [远景：浅城廓／莲花山剪影 · 少字]
┌─────────────┬──────────────────┬─────────────┐
│   S1 区     │    HUB 枢纽      │   S3 区     │
│ 斑马线引导台 │  任务单／阿莲站位 │ 调度亭大屏  │
│ 人行灯＋排队 │  休息点壶（S2-C） │ 车流条反馈  │
├─────────────┴──────────────────┴─────────────┤
│              S2 区（视觉核心·略居中偏下）      │
│     信号灯柱特写位 ＋ 流程图亭／拆解台面板锚点   │
└──────────────────────────────────────────────┘
```

| 分区 | 内容锚点 | 备注 |
| --- | --- | --- |
| **HUB** | 出生点、阿莲默认位、任务单、通往三站的琥珀胶囊门 | 中心；不另开幻想地图 |
| **S1** | 清晰斑马线＋一侧人行灯；2–3 行人简模排队 | 左或左上 |
| **S2** | 可切帧信号灯柱＋流程图亭；**S2-C 保温壶桌** 可贴 HUB 角不另图 | 中／中下，探究主场 |
| **S3** | 调度亭＋立柱大屏（故障红／正常青皮肤） | 右；运行反馈用简化车流条 |
| 边界 | 路缘 `#9CA3AF`、沥青 `#4B5563`、天空 `#7EC8FF` | 禁岛图／园区绿主调／奇幻柱阵 |

碰撞：工位用 Invisible 墙框住可点区；非教学区不给长廊。

---

## 3. 资产清单（2D 优先 · 可色块占位）

> **P0 可先用 ColorRect／占位 PNG** 跑通关卡；定稿再换精灵／瓦片。许可：本课定制；外引 Kenney 等须 CC0 并记 CREDITS。

### 3.1 角色精灵

| ID | 资产 | 规格 | 占位 |
| --- | --- | --- | --- |
| CHR-P | 玩家四向 sheet | 建议帧 32×32 或 48×48 逻辑；导出 2×／3× | 橙块＋圆头剪影 |
| CHR-L | 阿莲 三向＋半身立绘 | 同像素基准 | 橙块略高 |
| CHR-C | 路口领队 单向 idle | 可合并进 CHR-L 换帽 | 黄帽色块 |
| CHR-N | 行人 2–3 | 剪影／单色即可 | 灰剪影 |

### 3.2 瓦片／场景（可复用）

| ID | 资产 | 说明 | 占位 |
| --- | --- | --- | --- |
| TILE-road | 沥青＋路缘 | TileSet 主层 | 灰／浅灰格 |
| TILE-zebra | 斑马线条带 | 可叠加层 | 白黑条 |
| PROP-light | 信号灯柱 R/Y/G/off | 4 帧或 Shader 换色 | 竖条＋三圆 |
| PROP-booth | 调度亭＋屏框 | 屏内 UI 用 Control 叠字 | 蓝灰盒子 |
| PROP-thermos | 保温壶＋桌 | S2-C | 银椭圆＋桌面 |
| PROP-curb | 隔离墩／护栏简模 | 挡路用，勿做成黄柱通关标 | 短灰墩 |

### 3.3 UI／FX／法宝（图只做底，文案 Label）

| ID | 资产 | 说明 |
| --- | --- | --- |
| UI-task | 琥珀胶囊站门 | ≥56px 高触控 |
| UI-card | 步骤卡／情景卡底板 | **未选等权零高亮** |
| UI-flow | 起止／矩／菱／回边 图元 | 与考核同语言；回边粗琥珀 |
| FX-ring | FocusRing＋侧箭头 | 全课复用 |
| RELIC×3 | 斑马线哨／回边箭头／时长旋钮 | 图标 64px；配额 3 |

---

## 4. Mood Board 文案提示词（≤3 · 生图用）

**① 总览一屏（地图＋三站）**  
```
children's educational 2D game, Q-version chibi two-heads-tall, realistic-cartoon Shenzhen daytime smart intersection near Lianhua Mountain, zebra crosswalk, traffic lights, orange volunteer vests, dispatch booth screen, thermos on roadside rest table, soft 3/4 top-down one-screen map with three workstations, bright projection-friendly, modular props, no fantasy island, no solid yellow circle on faces, 1280x720
```

**② 角色定妆（玩家＋阿莲＋焦点环）**  
```
chibi two-heads-tall student in orange reflective volunteer vest, adult volunteer NPC same proportion slightly taller holding tablet, translucent amber oval focus ring at feet only with small side arrow, face clear unobstructed, clean cell-shaded, white background character sheet, game sprite reference
```

**③ S2 核心工位（灯＋回边流程图亭）**  
```
close-up traffic light pillar red amber green, roadside flowchart kiosk with thick amber loop-back arrow, Shenzhen daytime curb, educational UI panel empty for text, modular cutout friendly, no yellow pillar checkpoint, no dense text wall
```

**负面（三条共用）**：`island fantasy, jungle park patrol, solid yellow face highlight, yellow pillar end-state, cyberpunk night clutter, photoreal pores, high-poly 3D city spam`

---

## 5. Godot 落地备忘（短）

- 主场景：`IntersectionHub.tscn`；S1/S2/S3 为标记点或子场景实例，面板用 `CanvasLayer`
- 灯态：`AnimationPlayer` 或四帧 `Sprite2D`；循环演示可关
- 回边高亮：独立 `Line2D`，E1 可单独调 `width`／`default_color`
- 文案：一律 `Label`／`RichTextLabel`；禁烧进背景唯一文案
- 弹窗（先学卡／剧情回放／二刷）：右上 `×`／`Esc` 第 1 帧可关

---

## 6. 不做／交回

| 不做 | 交回 |
| --- | --- |
| 不开 Studio；不批量出图；不写前端；不改 01／02／03 | **五年级备课团队** 落盘本补丁；下游编程按 CHR／TILE 占位开工 |
| 不复用第6课园区地图壳 | 独立审查对照：禁岛／禁挡脸黄圈／方案 A／与巡检可区分 |

*版本：`g5l7-godot-art-patch-v1`｜责任人：美术风格｜角色方案 A 已锁。*
