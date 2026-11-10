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
- 不合 main（须老师再确认）

## 部署
见本文件提交后的回告：8797 是否已更新到本 tip。
