# 五年级第7课《重复操作用循环》· 本机 Codex 整合（2026-11-01）

Studio 前端壳已由 gemini4 交回，**在线正路径冒烟通过**。本机 Codex **只做整合与本地部署验证**（省额度路径），不要用额度重写整套前端 UI。

## 工作目录（唯一）
`/Users/jun/Desktop/2026-2027教学备课/五年级 身边的算法/按课拆分/第7课 重复操作用循环/莲花山智慧路口/`

同目录已有：
- Studio 解压前端（Vite React）
- `roster/五年级班级姓名名单.xlsx` + `roster/roster.json`（权威 212 人）
- `design/` 01–06 与规格副本（只读参考）
- `studio-pack/out/SMOKE_PREVIEW.md`（正路径通过证据）

参考实现（只读借鉴，勿改）：
- 第5课服务：`…/第5课 数学运算讲方法/生活算法站/server.cjs`（端口 8795）
- 第6课服务：`…/第6课 判断选择用分支/分支冒险岛/server.cjs`

## 权威锁项
- 情景：莲花山智慧路口·临时小交警；角色默认 A＝Q版二头身＋橙马甲
- 法宝整课 **3** 次；`/teacher` **免密**
- 分母：xlsx **212**；分班人数 **501=53、502=53、503=52、504=54**（以 xlsx／`roster/roster.json` 为准）
- 达标：基础 ≥13/16 且 G1≥3/5、G2≥2/3；挑战加分线 4/6
- 学生端禁出现「循环体」字面；题库答案不下发学生端
- **勿碰**端口 **8766** 与任何 `启动课堂.command`；测试用临时 `DATA_DIR` + 新端口（建议 **8797**）

## 必做（Phase A · 本轮必须完成）
1. **真实名单**：用 `roster/roster.json`（或解析同目录 xlsx）替换前端 mock `src/data/roster.ts`；登录人数与大屏分母一致；保留「名单外手动输入」。
2. **npm 可装可跑**：解决当前 peer 冲突（vite8 / esbuild / @tailwindcss/vite），`npm install` + `npm run build` 通过；本地 `npm run dev` 或生产预览可开。
3. **服务端整合**（对齐第5/6课口径，精简可移植）：
   - 名单登录会话；三站进度／法宝次数／考核提交证据落盘（sqlite 或等价，目录 `DATA_DIR`）
   - 开考：三站必做当前通过后可考；达标与奖励线服务端可复核
   - 教师大屏 `/teacher` 读服务端汇总；导出 CSV；免密
   - 学生端去掉「共享预览串进度」依赖，改为本机服务会话
4. **题库**：接入设计题库（`design/03` / `studio-pack` 学生侧 JSON）；学生端不下发答案字段。
5. **Git**：在本工作目录 `git init`（若尚无），建分支 `codex/g5l7-integrate`；如方便则 `gh repo create a86657485/5-07-lotus-crossing`（public，描述写清第7课）并推送开 **draft PR**。老师同意前不合并 main。
6. **自测报告**：按 L1–L6 写已验证／未验证；至少本地：登录真名单→跳过剧情→第1站可完成→teacher 见该生进度；附启动命令与端口。

## 可延后（Phase B · 本轮可只留脚手架）
- Godot 4 HTML5 导出 + `JavaScriptBridge` 桥（登录／证据／法宝）。前端壳已可演示探究；若本轮时间紧，写清 `godot/` 目录约定与桥接口草稿即可，**不要**为赶工重写整套 Web 玩法。

## 红线（绝对不要改）
- 题干／答案／达标线／奖励线／法宝配额 3／分层规则（除非交接包明文要求且只修实现 bug）
- 不直接改 main；不碰 8766 在线课

## 交回
- 分支名、commit SHA、PR 链接（如有）
- 改动文件清单
- 启动：`DATA_DIR=… PORT=8797 node server…` 或 package scripts
- `npm test`／关键自测结果
- 未完成项（尤其 Godot）

## Studio 产物来源
- 预览（已冒烟）：https://ais-dev-kwq56h32nbqr4dxiyiot7g-626092142623.asia-east1.run.app/
- 源码包：`协作记录/莲花山智慧路口·临时小交警.zip`
