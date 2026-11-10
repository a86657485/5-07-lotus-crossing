# 五年级第7课《重复操作用循环》·莲花山智慧路口

本版本保留原六张剧情图，重做三站交互：行人等灯流程、循环与分支及热水壶认读、路口信号时长比较。网页流程图采用 React Flow，提供执行轨迹、运行/暂停/单步、撤回、三错支持与选做巡检步道。

## 本地运行

需要 Node.js 22.13 或以上。

```sh
npm ci
npm run build
DATA_DIR="$PWD/runtime" PORT=8797 npm start
```

学生入口为 `http://localhost:8797/`，教师入口为 `/teacher`。局域网可使用本机IP同端口。教师页面保持免密码、限本机与私有网络范围。

- `localhost` 或安全上下文：Godot 4.7.2 原剧情和地图，任务通过消息桥接入网页流程图。
- 普通局域网 HTTP：自动使用同六张剧情图与同一任务组件的兼容宿主，避免 Godot 导出的安全上下文限制；学生无需修改浏览器设置。
- `ROSTER_PATH` 可指定本地名单文件；实际名单与课堂数据随本地运行目录管理。
- 学生选名用于课堂身份与进度隔离，不等于强身份账户认证；接口会话绑定当前所选身份。

SQLite 数据保存在 `DATA_DIR/classroom.sqlite`，含进度、过程、首答和修订、基础/挑战首次成绩、最近成绩及历史信息。更新代码不应清理此目录。迁移或备份应停服务后使用 SQLite backup，保留原数据和回退版本。

## 验证与导出

```sh
npm run lint
npm test
npm run build
```

Godot 源码变动后按 [Godot说明](godot/README.md) 重新导出、同步 `public/godot/` 再构建。对应版本的Web导出模板必须已经安装。

职责、目标对应和范围验收见 [协作记录](协作记录/01_责任与交接.md)。浏览器检查使用虚构身份与独立数据库，记录在 `docs/verification/`；技术验证不代表真实课堂学习效果或已实测所有学生设备。

## 素材与组件

原剧情图及网页副本已核对，见 `docs/verification/story-assets.json`。组件许可和新背景、教材引用说明见 [CREDITS](godot/CREDITS.md)。Blockly Games Maze、Botbright用于机制参考，本次没有复制其整套游戏、角色或关卡。
