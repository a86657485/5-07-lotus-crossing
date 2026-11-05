# Phase A 整合自测报告 · 莲花山智慧路口（g5l7）

> 本文保留 2026-11-01 的历史验证记录。当前整合、实际浏览器结果及 Godot/HTTP 边界以 [2026-11-05 续验报告](INTEGRATE_PHASE_A_2026-11-05.md) 为准。

- 日期：2026-11-01（Asia/Shanghai）
- 执行：Grok Bot 在老师 Mac 工作目录整合（老师指定例外路径）
- 工作目录：`/Users/jun/Desktop/2026-2027教学备课/五年级 身边的算法/按课拆分/第7课 重复操作用循环/莲花山智慧路口/`

## 启动命令

```bash
cd "/Users/jun/Desktop/2026-2027教学备课/五年级 身边的算法/按课拆分/第7课 重复操作用循环/莲花山智慧路口"

# 依赖
npm install

# 构建前端
npm run build

# 测试用临时数据目录 + 端口 8797（勿用 8766）
DATA_DIR="$PWD/.data-test" PORT=8797 npm start
# 等价：DATA_DIR=... PORT=8797 node --no-warnings server.cjs

# 开发（可选）：另开终端先起 server，再
# DATA_DIR="$PWD/.data-test" PORT=8797 npm start
# npm run dev   # Vite :3000，/api 代理到 8797
```

- 学生端：http://localhost:8797/
- 教师大屏（免密）：http://localhost:8797/teacher
- CSV：http://localhost:8797/api/teacher/export.csv

## L1–L6 验证

| 层级 | 状态 | 说明 |
| --- | --- | --- |
| L1 设计锁项对照 | 已验证 | 法宝配额3；达标 ≥13/16 且 G1≥3/5、G2≥2/3；挑战加分 4/6；分母 212（53/53/52/54）；/teacher 免密；情景未改 |
| L2 代码静态 | 已验证 | `npm run lint`（tsc）通过；学生包无 `STANDARD_ANSWERS`/`misconceptionMap`/`analysis`/`循环体`；题干选项中的可见文案保留 |
| L3 单元/规则 | 已验证 | `npm test` 6/6 通过；`quiz.cjs` 全对卷 → 16/5/3 达标 |
| L4 本地联调 | 已验证 | 真名登录「501 陈远晴」；progress 落盘；未三站开考被 409；三站后提交考核达标；`/teacher` 分母 212、entered 可见该生；`/` 与 `/teacher` HTTP 200 |
| L5 设备/浏览器实走 | 未验证 | 未做多机浏览器点点通（跳过剧情→第1站完整 UI 手点） |
| L6 课堂彩排 | 未验证 | 未进正式课堂；未碰 8766 |

## 抽样记录

- 名单：`roster/roster.json` → `src/data/roster.ts`（`studentId` 用 json `id`）
- 登录：`g5-501-88abd32d1b2fbc0a43a1` / 陈远晴 → 成功
- 教师分母：212；分班 501=53、502=53、503=52、504=54
- 开考门禁：仅 S1 完成时提交考核 → `请先完成三个探究站后再开考`
- 依赖：Vite 钉到 ^6（原 Vite 8 + TS 7 预发布有 peer/解析风险）；去掉未用的 `@google/genai` / express 直依

## 未完成 / 后续

- Phase B Godot：仅 `godot/README.md` 脚手架，未导出 HTML5
- L5 浏览器手点第1站完整通关未做
- 老师同意前不合并 main 作为正式上课入口
