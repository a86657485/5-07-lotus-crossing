# PR8 桥接修复核对及实机验收交接

记录时间：2026-11-10 20:56 Asia/Shanghai（UTC+8）。

## 最新基线与边界

- 已先 fetch/ls-remote 并核对 PR8：OPEN、Draft、未合并。
- main: `17a81f933ddd3b173d02e4f779e94055bc2ba9ab`。
- 候选起点/远程 PR8 head: `10d4cb972293eb3bdfd1997d301423b9164d6f2e`。
- 部署分支远程：`4c999159c32138ec416baa4bd67012b04bb04223`。
- 桥接修复来源：`849e622068b4318aa1970844c4d4b9c01c5e9c46`。
- 仅提取该提交的三个 `classroom_bridge.js`，没有 merge/cherry-pick 整个部署分支，未纳入 Windows/TUN/代理/补记数据脚本/部署缓存改造。
- PR8 五条件、角色、场景、评分与门禁设计不改。本次没有动 server.cjs，也没有修回看误清。
- `design/art-refs/` 与三张 JPG 是进入本轮前就存在的未跟踪素材；保留，不覆盖、不删除。

## 独立核对的根因

真实源码链条：`StationPanel.onComplete` → 宿主 `flow:result` → GDScript `ClassroomBridge._js_flow` 同步 signal → `main._on_web_flow_result` → `_on_s1_done` → `report_evidence`/`emit_to_js` → JS `emit('evidence:report')` 与 `emit('station:unlock')`。

旧 JS 在整个宿主 dispatch 中把 `receivingHostMessage=true`，因此同一栈内所有向父窗口发出的事件都被拦，不仅是同名回声。Godot 本地先把站状态设 true，服务端却收不到 `evidence_lock`；“现场过关、刷新丢失”与此路径吻合。S3 的 `progress:s3Detail` 同样受影响。

修复是同名事件保护 + dispatch 深度 + FIFO pendingOut；异名事件退出最外层宿主栈后按序补发。三份源码/导出/公开桥接 byte-identical。

不是单凭提交说明采信：先在旧代码运行新增用例，9 项中 6 项失败；换成修复后三份桥接全部通过。`before.tap` / `after.tap` 留存。测试调用了 GDScript 文件中实际 JS binder，但其 callback 是 VM 替身，**不等于实际 Godot/WASM 已跑过**。

### 队列与宿主职责

- 回归覆盖 flow:close → evidence:report → station:unlock → progress:s3Detail 的顺序、同名回声抑制、嵌套宿主消息、异常回调后仍排空、下一次 dispatch 不重发、来源/origin 防护及三副本一致。
- GodotPlayView 只把 evidence:report/station:complete 转给 onEvidence；`station:unlock` 本身不写服务端完成字段。不能把收到了 unlock 事件当作持久化成功。
- 宿主 App.flushEvidence 原有 FIFO 写入/失败重试和 stateVersion 防旧响应逻辑保留；本次未改 React 队列。
- HTTP 回归的 FIFO adapter 是测试适配器，**没有执行 React UI 事件处理器**；网络断线重试竞态仍需实际浏览器验证。

## 自动化结果（本轮无任何浏览器/Playwright/ComputerUse）

- `node --test godot/bridge/classroom_bridge*.test.cjs`：11/11。
- `npm test`：TS 60/60；quiz 通过；CJS 34/34（含桥接/服务端）。
- `npm run lint`：通过。
- `npm run build`：通过，仅已有 bundle >500KB 提醒。
- `git diff --check`：通过。
- 隔离静态 HTTP 检查：`/godot/classroom_bridge.js` 200，Cache-Control=no-cache，内容 sha256 与源文件相同：`ba497dfd20f2545d53bd28354879db3e1d8d86106b04cbff9ee1929b84c7c925`。没有导入部署分支缓存改造。

`classroom_bridge.persistence.test.cjs` 启动真实 HTTP/SQLite 服务，用测试 roster + mkdtemp 私有数据目录、随机回环端口。分别对 Web evidence envelope 和 VM 桥接出站事件入库进行验证：

1. S1 锁定后 `s1_order/s2_rewrite=true`，GET（刷新读取层）仍 true，testedConditions 五条保留。
2. 换到 S2B，完成 `s2_vs_branch=true`；服务关闭/重开同 DB 后字段未丢。
3. 同学生重新登录后字段仍在；完成 S2C/S3 后五字段都 true、三法宝解锁、examOpen=true、S3 detail 保留。
4. 重复同 eventId 不增证据/版本。
5. **已知问题复现**：回看已完成 S1 后发 current_invalidated(edit)，s1_order/s2_rewrite 变 false；重新登录仍 false。这是源码/server 接口层复现，不是本轮 UI 实测。未改此语义，不清课堂记录。

结构化证据在 `persistence-evidence.json`；测试库在结束时删掉，只清理该用例自己 mkdtemp 的隔离目录。

## 实际浏览器/Godot 验收：待 computerUse 执行

**本轮尚未执行实际 Godot，也未重跑 Web 浏览器全路径。** 五条件上一轮 Web 15 张截图不能冒充本轮 Godot 证据。

### 已备好的服务

- box 上隔离服务在 **19011**，DATA_DIR=`/tmp/g5l7-pr8-bridge-20261110`，使用候选分支 production dist。
- Godot 真路径：`http://127.0.0.1:19011/`。IPv4 回环地址 secure context 应嵌入 `iframe title=g5l7-godot`；必须能看到真实 Godot 地图，不能把 Web 地图当作 Godot。若 WASM/图形失败，截图/控制台报错后停止，不注入模拟完成事件替代。
- Web 真路径：`http://172.30.0.2:19011/`（box IP；若环境换 IP，先 hostname -I）。普通非 secure HTTP 应走 Web 地图。
- 只用 **501 班→名单外手动输入**：Godot 测试名 `桥接Godot隔离1110`，Web 测试名 `桥接Web隔离1110`。没有密码。两名学生分离，避免通关记录污染另一条路径。
- 不要使用真实课堂学生，不要访问 8797/8766，不要启动部署脚本。
- 服务若停止，可在本 worktree 执行：
  `PORT=19011 HOST=0.0.0.0 DATA_DIR=/tmp/g5l7-pr8-bridge-20261110 node --no-warnings server.cjs`

### 精确验收流程（两条路径各一遍）

1. 登录指定测试名；首刷剧情按“下句/好的”看到结束，不跳过。
2. 到 S1（Godot 用地图 S1 入口/传送或焦点引导后交互，打开的五条件 StationPanel 是正常的 Web 面板，不是绕过 Godot）。关闭可关的先学卡。
3. 顺序点五卡并运行看完：天桥→三次→原地观察→到达对面→绿灯未亮起。确认走天桥一次、其余角色及画面对应，未满不出完成。
4. 进入定稿，选“绿灯未亮起？”，点“是”端口再点“观察红绿灯”；点“否”端口再点“过马路”。两种灯色各运行并看完；完成引导台。
5. **Godot关键**：完成按钮由宿主发真实 flow:result；不调用 api.emit/注入模拟。保留浏览器网络 POST /api/evidence 200；iframe 消息若 ComputerUse 可查看，须能对应真实 Godot evidence:report、station:unlock，而非只有宿主本地面板状态。随后用下面只读检查器立即确认 s1_order/s2_rewrite=true 与 evidence_lock(E1) 存在；核对 testedConditions 五个。
6. 成功剧情结束→S2B。必须甲/乙都运行观察过才能检查；回选甲/点回边作为依据/检查/继续热水壶。确认天桥图标、阿莲和玩家。
7. 刷新当前页，用**同班同名**重新登录（应用 session token 不跨刷新保留，回到登录页不算数据丢失），查同 studentId、S1 字段仍 true、S2 入口可用；不要为了回看而改卡，以免触发已知 invalidation。
8. S2C 跑80与100℃、完成三项认读及先后对照（甲可能不擦→运行对比→回壶），检查→完成。查看 s2_vs_branch/s2_kettle=true；Godot 确认 S3 解锁。
9. S3 先运行原方案，再选6格+“让等待较多的这一侧多通行一些”，再运行→完成；查 s3_timing=true、S3 detail、examOpen，并保留阿莲/玩家/领队/窗外天桥截图。
10. 再刷新/重新登录该测试学生，字段保持；切换另一个测试名再登回原名，身份/进度不串。剧情回放首次可关的行为顺带核对。
11. 最后单独对隔离测试名回看已通关 S1 改卡，观察是否出现 current_invalidated，并只读核对字段清除；记录为已知 bug。不要在完成验证之前做这一步，不擅自修设计。

### 服务端检查方式（无凭据/只读）

`node --no-warnings docs/verification/bridge-20261110/inspect-isolated-state.cjs`

检查器硬编码隔离 SQLite 路径，只 SELECT 两名测试生的 states/evidence，不读 sessions、不写 DB。每个关键节点把输出保存为 `computeruse-*-state.txt`；截图放本目录。也可用免密隔离教师页 `http://127.0.0.1:19011/teacher` 对照，但教师界面不能代替底层字段。

当前检查器输出：No browser test students yet。因此此文不声称实际 Godot/Web UI 已验。


## 20:59 Asia/Shanghai：隔离服务连接恢复核对

- 服务未停止：PID **775057**，父进程 775053，命令 `node --no-warnings server.cjs`，监听 **0.0.0.0:19011（IPv4）**。
- localhost 解析优先 `::1`；`curl -6 http://localhost:19011/` 连接拒绝（000），`curl -4` 及 `http://127.0.0.1:19011/` 均 200。与 computerUse 的 localhost 连接拒绝相符；浏览器根因仍需 computerUse 确认。
- 精确继续 URL：**http://127.0.0.1:19011/**。Chromium 把 127/8 回环视为可信源，故仍应走 secure-context/Godot 分支；未在浏览器验证，必须确认实际 iframe/WASM 成功。
- 无须重启、换端口或再次启动服务。端口占用来自上述已知隔离 node；没有杀任何进程。
- HTML、Godot HTML/JS/bridge/WASM/PCK、`/api/roster` 全部 HTTP 200；详见 `connectivity-ipv4.txt`。
- DATA_DIR、测试姓名和只读检查器均不变。127.0.0.1 与 localhost 的浏览器存储域不同，需按既定 501 班测试姓名重新登录；不要复制凭据、不要注入通关事件。
- 只读检查器仍无测试生，不能据此认定实际 Godot 通过。
