# FIX：intro 首刷不可跳过（2026-11-10 Asia/Shanghai）

## 问题
全流程检测 `intro-first-view-skippable` FAIL：首刷 intro（及进站剧情）可通过「关闭剧情」或 Esc 直接关闭。

## 改动
文件：`src/components/lesson/WebLessonPlayView.tsx`

- `finishStory(skipped)`：当 `skipped && !story.replay` 时直接 return（防跳过）。
- Esc：仅 `story.replay === true` 时调用 `finishStory(true)`。
- 关闭钮：仅回放渲染「关闭剧情」；首刷隐藏，须点「下句」走完到「好的」。
- 进站剧情（s1/s2/s3 等）默认 `replay=false`，同样不可关。

检测脚本 `check-fullflow-guide-focus-story.cjs` A0 探针同步：首刷无关闭钮或点/Esc 不关 → PASS。

## 分支 / PR
- 分支：`fix/g5l7-intro-no-skip`
- commit：`59f7dbd6b36c`（`59f7dbd6b36c1b8efe61905d40b1b487b5879f86`）
- Draft PR：https://github.com/a86657485/5-07-lotus-crossing/pull/6
- **不合 main**（须老师再确认）

## 部署（本机课堂 8797）
- 已更新到 tip release：`/Users/jun/.local/share/classroom-apps/5-07-lotus-crossing/releases/59f7dbd6b36c`
- 学生／教师入口 HTTP 200；bundle `assets/index-DLzUmM0u.js`
- 未合 main，仅 tip 部署便于立刻验收

## 复测（最小化 Playwright，BASE `http://192.168.0.14:8797`）
脚本：`retest-intro-no-skip.cjs` → **PASS 5/5**

| 项 | 结果 |
|---|---|
| first-view-close-hidden | PASS（closeCount=0） |
| first-view-esc-noop | PASS |
| first-view-complete-enters-map | PASS |
| replay-close-works | PASS |
| replay-esc-works | PASS |

报告：`retest-intro-no-skip-report.json`（完成约 2026-11-10 09:26 Asia/Shanghai）
