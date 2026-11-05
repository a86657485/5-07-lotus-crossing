# 2026-11-05 Phase A 整合与本地续验

## 范围与 Git

- 工作目录：本仓库根目录，未另建或重写一套前端。
- 起始主线：`7f78931`，已有 Godot RPG、流程图与美术导出。旧整合分支与它分叉；本轮在 `codex/g5l7-integrate` 合入当前主线，保留主线全部文件基线后补整合缺口。
- 本轮没有修改 `main`；沿用公开仓库 `a86657485/5-07-lotus-crossing` 和 [Draft PR #1](https://github.com/a86657485/5-07-lotus-crossing/pull/1)，不自动合并。
- `design/`、权威名单、题干、标准答案、达标线及奖励线均保持原样。分层解锁按 `design/05` §4.2：提交基础层后可进入挑战；基础和挑战首答各自保留。

## 实际修复

1. 登录签发绑定学生的会话凭证，学生读写接口要求 Bearer；同一名单身份可重新登录恢复 SQLite 状态，各浏览器标签页不共用预览进度。
2. 服务端固定法宝总额 3；普通进度不能回补次数、伪造考试已提交或奖励。当前三站不齐、重做后或 S3 改规则未重验时禁止新交卷。
3. 基础首答、挑战首答、最近结果及每次提交分别保留；空白挑战明确按 `tier=challenge` 冻结 0 分。旧数据从最早历史事件恢复首答。学生结果不附教师题级对错／错因。
4. 原始站事件追加到 SQLite `evidence` 表，记录服务端接收时刻；身份归属由当前会话补齐，跨学生事件被拒绝。交卷状态与事件在同一事务保存。
5. 进度保存串行且只发变化字段，考核入口等待保存完成再读服务端门禁。修正 Godot E1 对 S1 的兼容映射；教师行登录态读 `entered`，统计分子和分母均使用正式名单，手动身份仍留在明细／CSV。
6. CSV 统一转义并防手动姓名触发公式；静态 WASM 使用正确 MIME，设计 Markdown 与服务端源文件不作为学生资源提供。
7. Godot 桥修复 JSON 数据转换及实际 JS 回调注册；校验父窗口／iframe 同源来源，避免宿主消息回显。S3 当前状态实时上报，E4 保存先于自动开考。重新导出并同步 HTML5。
8. HTTP LAN 不具备安全上下文，当前 Godot 4.7.2 模板无法启动。普通 HTTP 自动复用已交回的 Studio 三站组件；localhost／可信 HTTPS 保留 Godot。二者使用同一服务端进度、法宝、考核与教师汇总。
9. 客户端提交编号改用普通 HTTP 可用的 `getRandomValues`；Vite 代理保留原 Host，使开发环境登录通过同源检查。考核退出再进入恢复本人作答与首答结果。

## 启动与隔离

既有 8797 服务使用 `.data-local`，本轮未重启它或写入其数据库。未操作 8766、任何 `启动课堂.command`。

本轮临时验收服务：

```bash
cd "/Users/jun/Desktop/2026-2027教学备课/五年级 身边的算法/按课拆分/第7课 重复操作用循环/莲花山智慧路口"
npm install
npm test
npm run lint
npm run build
DATA_DIR=/tmp/g5l7-phase-a-MQD7d3 PORT=18797 npm start
```

- 本机学生：`http://127.0.0.1:18797/`
- 本机教师：`http://127.0.0.1:18797/teacher`
- 本次物理网卡 IP：`192.168.0.14`；学生 `http://192.168.0.14:18797/`，教师末尾加 `/teacher`。IP 为本轮快照，换网后需重查。
- CSV：`/api/teacher/export.csv`；分班使用 `?classId=501`。
- 开发代理另用 18798 测试，`VITE_API_PROXY=http://127.0.0.1:18797 npm run dev -- --port 18798`；验证后关闭该临时开发进程。
- `/tmp` 是测试数据，系统清理后可能丢失。正式课堂请选持久 `DATA_DIR`；本轮未替换现有 8797 常驻服务。

## L1–L6

| 层级 | 本轮状态 | 证据与边界 |
| --- | --- | --- |
| L1 设计与权威源 | 已验证 | XLSX 与 JSON 212 人逐行相同；53/53/52/54；22 题及答案和设计一致；配额与判线不变 |
| L2 静态与构建 | 已验证 | npm install、tsc、生产构建通过；学生安全题库无答案／解析／错因字段；学生源无禁用字面 |
| L3 自动规则与持久化 | 已验证 | TS 15 项、服务端 15 项、JS 桥 2 项及原 quiz 回归通过；Godot 19 checks 与最新 PCK 独立 smoke 通过 |
| L4 本机真实联调 | 已验证 | localhost Godot S1 实际点卡接线；普通 LAN IP 的 Studio 真名登录→跳过剧情→三站完整操作→自动开考；教师记录与五份原始证据可查；临时服务换 PID 后状态保留、SQLite quick_check=ok |
| L5 网络与设备 | 部分验证 | 同一台 Mac 的物理 LAN IP 上 HTTP Studio 全程通过；浏览器教师 CSV 下载成功。Godot 普通 LAN HTTP 启动失败已定位并自动使用 Studio；尚未用另一台物理设备验收，也未做全班并发 |
| L6 课堂彩排 | 未验证 | 未进入真实课堂；不以 API、headless 或同机浏览器结果代替课堂结果 |

## 浏览器操作与证据

本机 Chrome 已完成真名单登录 → 首看 Godot 剧情逐句完成 → 回放关闭 → S1 选择判断、连接是／否分支、锁定回放 → 教师页查看记录。Godot 首看不可跳过为已有版本行为。

普通物理 LAN IP 的 HTTP Studio 真实浏览器路径已另外通过：选择第二位 501 名单身份 → 登录 → 点击“跳过剧情” → S1 五步排序、指出等待步骤、领取碎片 → S2 条件／动作／回边、循环与分支对比、保温壶三项认读 → S3 运行故障、选择时长策略、说明理由、等待重验 → 自动开考。没有用 API 替代该生的三站操作。教师页面该生 S1／S2／S3 三格均显示完成；服务器记录五个必做 taskId 各有原始证据，`examOpen=true`。同一临时数据集还有另一位 Godot 验收身份，因此此时正式概览为 entered=2/212、S1=2/212、S2=1/212、S3=1/212；手动测试身份未加入这些分子。

教师浏览器实际点击导出按钮，成功下载 `g5l7-teacher-export.csv`，保存为本地 `output/playwright/teacher-export-test.csv`。该文件仅是隔离验收数据，不能当作正式课堂成绩。

另用名单外“HTTP局域网验收”身份测试实际交卷按钮：该身份的三站状态**由 API 准备，仅用于考核壳测试**，不算三站 UI 通关。普通 LAN HTTP 下 `isSecureContext=false`、`crypto.randomUUID` 不存在，浏览器仍成功提交基础空白卷并显示 0/16；挑战入口按已提交基础解锁，再提交挑战空白卷，界面与教师记录均为挑战首答 0/6。未将该手动身份计入正式分子。

Godot 第一次实际浏览器核验发现：即使 JSON 解码回归通过，旧 `bind.call(...)` 仍未真正注册回调。修成 `js_window._g5l7Bind(...)` 并重导后，再次真实操作 S1，iframe 原始 E1 的学生 ID、班级、轮次和 conditionCardId/backEdgeTo/noEdgeTo 均正确；此证据没有依赖服务端补齐身份。

本地截图在 `output/playwright/`（已忽略，不推送学生名单截图）：

- `02-hub.png`、`03-story-replay.png`：已有 Godot 场景及可关闭回放。
- `06-s1-board.png`、`07-s1-condition.png`、`08-s1-complete.png`：实际流程图交互。
- `09-teacher-s1.png`：教师已登录 1/212、S1 1/212、真实学生行已完成。
- `13-lan-exam.png`：修复前普通 LAN HTTP 的 Godot 安全上下文错误，保留为限制证据。
- `14-lan-studio-map.png`、`15-lan-s1-complete.png`、`16-lan-s2-complete.png`、`17-lan-s3-complete.png`、`18-lan-auto-exam.png`：普通 LAN HTTP 原 Studio 三站实际通关及自动开考。
- `19-lan-teacher-three-stations.png`：教师看到该生三站完成。
- `21-lan-empty-challenge.png`：实际普通 HTTP 交卷及空白挑战首答 0/6 的反馈（手动测试身份）。

服务端测试全部使用 `mkdtemp` 和 `127.0.0.1:0`；浏览器仅写上述临时 `DATA_DIR`。局域网考核壳测试若使用 API 准备三站状态，必须在本报告中另注明，不能算完整三站 UI 通关。

## 未完成与 Phase B

- Godot 已有实际源工程和 HTML5 导出，本轮并非仅脚手架；本机桥及 S1 已验。但普通 LAN HTTP 的 Godot 不能启动，可信 HTTPS、证书信任和另一台物理设备上的完整 Godot 验收留待 Phase B。
- Godot 三站的程序化 smoke 已通过；完整三站浏览器逐关操作、所有剧情分支和主脚本旧 `--smoke` 入口未全面验收。
- `design/05` 的完整教师重开本课／runId 管理、教师关考、正式／测试命名空间、断网 outbox 及完整首答／支持后过程分档未全部实现。本轮通过隔离 DATA_DIR 避免测试污染，不宣称完整规格全部完成。
- 未实测另一台电脑／平板、多设备并发、真实课堂；未合并 main。

## 改动文件清单

- `.gitignore`
- `README.md`
- `docs/INTEGRATE_PHASE_A.md`
- `docs/INTEGRATE_PHASE_A_2026-11-05.md`
- `godot/README.md`
- `godot/bridge/classroom_bridge.js`
- `godot/bridge/classroom_bridge.test.cjs`
- `godot/export/web/classroom_bridge.js`
- `godot/export/web/index.html`
- `godot/export/web/index.pck`
- `godot/project/export_presets.cfg`
- `godot/project/scripts/bridge/classroom_bridge.gd`
- `godot/project/scripts/main.gd`
- `godot/project/scripts/stations/s3_timing.gd`
- `godot/project/scripts/tools/bridge_regression.gd`
- `godot/project/scripts/tools/bridge_regression.gd.uid`
- `godot/project/scripts/tools/smoke_playthrough.gd`
- `package.json`
- `public/godot/classroom_bridge.js`
- `public/godot/index.html`
- `public/godot/index.pck`
- `server.cjs`
- `server.test.cjs`
- `src/App.tsx`
- `src/api/client.test.ts`
- `src/api/client.ts`
- `src/components/views/ExamView.tsx`
- `src/components/views/GodotPlayView.tsx`
- `src/components/views/Station1CrosswalkView.tsx`
- `src/components/views/Station2LoopAnalysisView.tsx`
- `src/components/views/Station3TimingDispatchView.tsx`
- `src/components/views/StudioPlayView.tsx`
- `src/components/views/TeacherDashboardView.tsx`
- `src/utils/progressSync.test.ts`
- `src/utils/progressSync.ts`
- `src/utils/studioPlay.test.ts`
- `vite.config.ts`
