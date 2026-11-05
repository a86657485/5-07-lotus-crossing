# 五年级第7课《重复操作用循环》· 莲花山智慧路口

Studio React 登录／三站探究／考核／教师大屏，与已有 Godot 4 HTML5 场景整合。课堂服务使用 Node.js 自带 SQLite，支持局域网访问，不需要 Gemini API Key。普通局域网 HTTP 复用 Studio 探究界面；localhost 或可信 HTTPS 使用已有 Godot 场景。

## 安装、构建与启动

需要 **Node.js ≥22.13**（含 `node:sqlite`）及 npm。

```bash
npm install
npm test
npm run lint
npm run build

# 在本项目目录执行；选用空闲端口和单独的数据目录
DATA_DIR="$PWD/runtime" PORT=8797 npm start
```

- 学生：`http://localhost:8797/`
- 教师：`http://localhost:8797/teacher`，本机／局域网免密
- CSV：`http://localhost:8797/api/teacher/export.csv`，支持 `?classId=501`
- 其他设备用教师机当前局域网 IP 替换 localhost；服务默认绑定 `0.0.0.0`。
- 若 8797 已被占用，使用另一空闲端口。本轮隔离验证使用 **18797**；禁止占用受保护的 **8766**。

开发时先启动同一个服务端，再执行 `npm run dev`。Vite 默认端口 3000；`/api` 默认代理到 8797，可用 `VITE_API_PROXY=http://127.0.0.1:18797 npm run dev` 改为测试服务。完整学生和教师联调应使用上述 Node 服务提供的生产构建。

## 名单与数据

权威名单为本地 `roster/五年级班级姓名名单.xlsx` 与 `roster/roster.json`：**212 人**，501=53、502=53、503=52、504=54。登录和教师分母均使用该名单；名单外手动身份保留于明细及 CSV，不增加正式分母。

`DATA_DIR/classroom.sqlite` 保存身份、登录凭证、当前站进度、法宝次数、原始站证据、基础／挑战首答以及后续提交历史。备份时应先正常停服，或使用 SQLite 在线备份；不要只在运行时复制主数据库文件而漏掉 WAL。

学生页面每次登录领取绑定身份的服务端凭证。换浏览器／刷新后重新选择同一身份即可恢复服务端进度；凭证不使用共享预览存储。课堂内选姓名属于身份选择，未设置个人密码。

## 已锁定规则

- 整课法宝 **3 次**，换站／重做当前关不恢复；普通进度同步不能回补次数。
- 三站必做任务**当前通过**才可开考；S3 改规则后需要重新验证。
- 基础首答 **≥13/16 且 G1≥3/5、G2≥2/3**，奖励小游戏同门槛。
- 挑战按 `design/05` §4.2 在基础提交后解锁，首答 **≥4/6** 加分，不改变基础达标结果。基础与挑战各自冻结首次提交，空白挑战提交计 0 分。
- 学生题库只包含展示字段；标准答案、解析和题级诊断留在服务端／教师侧。

## Godot 导出与验证

已有主场景位于 `godot/project/`，HTML5 导出同时保留在 `godot/export/web/` 和 `public/godot/`。无需为启动 Node 服务重新安装 Godot。

```bash
godot --headless --path godot/project --import
godot --headless --path godot/project --script res://scripts/tools/bridge_regression.gd
godot --headless --path godot/project --script res://scripts/tools/smoke_playthrough.gd
godot --headless --path godot/project --export-release Web ../export/web/index.html
cp godot/bridge/classroom_bridge.js godot/export/web/classroom_bridge.js
cp -R godot/export/web/. public/godot/
npm run build
```

使用无线程 Web 导出。当前 Godot 4.7.2 模板仍要求安全上下文，普通 LAN IP 的明文 HTTP 不能启动 Godot；应用在此环境自动使用已有 Studio 三站组件。Godot 本机 localhost 已验证，可信 HTTPS 与真实跨设备 Godot 验证留待 Phase B。最新独立 smoke 适配当前流程图玩法；主脚本原有 `--smoke` 分支使用旧站点 API，不用作本轮验收命令。

本轮验证、启动端口、已验证／未验证边界及改动清单见 [2026-11-05 Phase A 自测报告](docs/INTEGRATE_PHASE_A_2026-11-05.md)。整合工作在 `codex/g5l7-integrate`，Draft PR 保留待老师审阅，不自动合并 main。
