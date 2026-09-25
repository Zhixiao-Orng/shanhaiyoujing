# 见全局·山海有径

面向长线任务的本地可视化看板，提供主任务与子任务脑图、想法池、状态管理、工作日志和配套 Codex / WorkBuddy Skill。

工程标识沿用 `task-atlas`，界面中的“任务图谱”是功能名称。Codex、WorkBuddy 均由作者亲自测试，确认支持。其他 Agent 作者尚未测试，但不代表无法使用。

这是“本地网页应用 + 本地服务 + Skill”，不是只有提示词的技能包。无需注册云端账户；任务数据库保存在运行程序的电脑上。AI 协作在 Codex 或 WorkBuddy 对话中进行，看板不提供独立 AI 聊天入口。

## 安装与启动

运行最低要求为 Node.js **22.12**（含 npm）。已实测版本为 macOS 上的 **24.19.0**、Windows 上的 **22.22.2**；最低要求不表示所有更高版本均已验证。配套 Skill 启动器另需 Python **3.9 或更新版本**，仅通过 npm 使用看板不需要 Python。

下载本仓库并解压到自己的目录，在该目录打开终端：

```sh
cd app
npm ci
npm run build
npm start
```

打开 http://127.0.0.1:47823 。使用指南位于 http://127.0.0.1:47823/guide.html ，也可从看板右上角打开。公开在线说明书：https://zhixiao-orng.github.io/shanhaiyoujing-guide/ 。首次安装需要联网下载依赖，日常任务管理在本机运行。

停止服务：在运行 `npm start` 的终端按 Ctrl+C。下次使用只需再次运行 `npm start`，不需要重新安装。启动前若端口被占用，请先确认已有服务，不要重复启动。

## 可选：接入 Codex 或 WorkBuddy

将整个项目放到自己的 Codex 技能目录下，例如 `~/.codex/skills/task-atlas/`。该目录应直接包含 `SKILL.md`、`scripts/` 和 `app/`，不要只复制 SKILL.md。完成上述构建后，在新对话中要求“使用 task-atlas 任务图谱技能”。

WorkBuddy 用户将整个项目安装到自己的 WorkBuddy 技能目录（通常为 `~/.workbuddy/skills/task-atlas/`，以客户端实际配置为准），再在对话中要求读取该技能。不同客户端的内嵌页面能力不同，也可用普通浏览器打开本机地址。

如果项目保存在其他位置，也可以将该目录链接到技能目录。自定义了 CODEX_HOME 的用户，应使用实际配置的技能目录。不同客户端的技能加载机制可能不同，本项目不假定所有客户端自动识别。

技能启动器在项目根目录使用：

```sh
python3 scripts/atlas.py start
python3 scripts/atlas.py sync examples/plan.json
```

示例导入为显式操作，不会在安装时自动写入。后台启动方式将日志写入 `app/.data/server.log`；需要方便停止服务时，优先使用前台 `npm start`。

## 数据与更新

看板不提供任务云同步。通过 AI 对话处理任务时，相关内容可能进入 Codex 或 WorkBuddy 所使用的 AI 服务；不能据此承诺整个协作过程完全不上传。

默认数据库为 `app/.data/taskboard.sqlite`。备份时先停止服务，再复制整个 `.data` 目录。更新代码时保留此目录，重新执行 `npm ci` 和 `npm run build`，再重启服务。不要用新的空数据目录覆盖已有数据。

默认只监听 `127.0.0.1`，无需开放公网或配置服务器。网页的版本弹窗仅提醒加载已部署的新版本，不会自动从 GitHub 下载或安装软件。更改发布版本时维护 `app/web/public/release.json`。

Node 可通过 PATH 查找，也可用 `TASK_ATLAS_NODE` 指定可执行文件。Skill 启动端口可通过 `TASK_ATLAS_PORT` 修改；直接运行服务时使用 `CODEX_TASKBOARD_PORT`。两种启动方式请使用相同端口。

## 开发与来源

```sh
cd app
npm run typecheck
npm run dev
```

基于 [dashi-taskboard](https://github.com/zeng-xiangwang/dashi-taskboard) 修改，保留上游 MIT 许可证，见 LICENSE 与 THIRD_PARTY_NOTICES.md。

## 验证范围与试用限制

本包为 v0.1.0 本地运行源码试用版，不是桌面安装程序。

- macOS：本地构建、界面操作和发布测试已验证，Node 24.19.0。
- Windows：用户提供的另一台电脑测试报告确认安装、构建、前后端、CLI、SQLite 与状态/想法落库通过，Node 22.22.2。用户随后确认新版复测通过；本地未独立复核该次 Windows 日志。
- Linux：未验证，不作兼容承诺。Windows 可用 `py -3` 替换示例中的 `python3`，前提是安装了 Python 启动器。
- Node 22 的 SQLite 可能显示 experimental 警告；警告本身不等于运行失败。

运行 `cd app` 后执行 `npm run check`，会进行类型检查、构建和本地版核心自动化测试。测试使用独立临时数据库，不访问真实任务数据；不代替触控板拖动等人工交互测试。

服务仅允许本机访问，发布版已关闭云端连接、内置 AI 聊天及工作流/开发上下文后台入口。保留的上游内部文件不表示这些功能受支持。没有本地用户账号隔离，同一电脑上有权限的程序仍可调用本地接口。

数据库已有按列检查和状态升级逻辑，但并非所有历史版本组合都已验证。升级前停止服务并备份 `.data`；若升级失败，停止程序，恢复备份与原版本，不要在唯一一份数据上反复尝试。未来涉及数据库结构变化的发布必须补充迁移测试。

版本记录见 CHANGELOG.md，检查范围和已知限制见 RELEASE_CHECKLIST.md。

## 联系作者与意见反馈

意见、使用问题或功能建议可通过 [GitHub Issues](https://github.com/Zhixiao-Orng/shanhaiyoujing/issues) 提交，也可发送邮件至 [Adrian123_orange@163.com](mailto:Adrian123_orange@163.com)。小红书：滞销橙子。公开反馈或发送截图前，请遮盖私人任务内容。
