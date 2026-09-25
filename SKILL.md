---
name: task-atlas
description: 为长线、多阶段任务生成并持续更新任务图谱，在 Codex 右侧展示总目标、阶段、子任务、依赖和想法池。用户要求任务看板、任务图谱、跟踪整体计划，或用户在关联项目的对话中提出新想法、新方向、“以后可以”“要不试试”等延伸建议时使用，主动暂存想法池；不为简单问答建立项目。
---

# 任务图谱

本技能所在目录就是 Task Atlas 安装根目录，应用位于其下的 `app/`。先确认当前 `SKILL.md` 的实际路径（软链接需解析到目标目录），再在该根目录执行命令；不要假定用户名、安装位置或 Node 路径。
统一命令前缀（以下命令均在安装根目录执行）：

```sh
python3 scripts/atlas.py
```

需要 Python 3 和 Node.js 22.12+。首次使用前，按根目录 README 完成依赖安装和构建。默认仅在本机运行，不配置云端账户或远程服务。每次开始操作前读取当前安装目录中的最新技能规则。

## 建立与展示

- 把已与用户确定的计划作为内容来源；不要将演示数据写成用户的真实进度。阶段数量按实际计划，不固定六个。
- 使用 `cli project list`、`cli issue list --project ID` 找到既有计划。一个长期目标可有多个阶段与多层子任务。复用已有项目，不因换对话重复创建。
- 将计划 JSON 写入当前任务工作目录，再执行 `sync /absolute/plan.json`。格式见下文。key 在同一项目内稳定且唯一；以后改名仍保留 key。sync 按 key 更新，不删除其他任务；未传 status 时保留状态。它会同步父子关系，不会从对话后台自行抽取内容。
- 执行 `start` 按需启动本机服务。将返回的项目 URL 用 `mcp__codex_app__open_in_codex` 的 browser 目标、`placement:"right"` 打开。该方式是右侧浏览面板，不是原生左侧栏扩展。无该工具时交付 URL。

```json
{
  "project": {"id": "learning-system", "name": "自动化学习系统"},
  "nodes": [
    {"key": "goal", "title": "总目标", "description": "验收条件"},
    {"key": "stage-1", "parent": "goal", "title": "1. 第一阶段"},
    {"key": "step-1", "parent": "stage-1", "title": "具体行动"},
    {"key": "idea-1", "title": "待考虑的想法", "idea": true}
  ]
}
```

id/key 使用小写英文、数字、短横线。nodes 顺序决定同级显示顺序。新任务默认进入积压；已存在任务省略 status 可避免覆盖用户在界面中修改的状态。

## 自动收集对话想法

在用户启用本技能进行任务跟踪后，按下列规则暂存新想法；用户明确要求关闭收集时停止。在使用本 Skill 的项目对话中，每轮识别用户提出的明确新方向、可行性设想和以后可发展的建议，处理当前请求的同时完成暂存。

1. 先明确项目归属：使用本轮/本对话已确定的项目 ID；若缺失，用 project list 和现有任务的 threadId、名称及内容核实。不要根据浏览器恰好打开的演示页推断归属。多个项目都合理时询问一次归属，不擅自放入演示项目。
2. 区分“用户提出的方向”和一般提问、引用、否定、明确放弃的设想。只收集前者。助手自己的建议未经用户采纳，不作为用户想法保存。用户直接要求立即实施的事项进入正常任务处理，不再复制成想法；明确要求不记录时不保存。
3. 先执行 `cli issue list --project ID`，检查现有想法池和主线任务。内容重复则复用已有记录；补充已有想法时使用评论，不新建重复项。
4. 用用户原意写简短标题，在 description 保留用户关键原话和提出时的上下文；不要把“可能”改成“决定”，不要自动改变主计划或创建依赖。
5. 执行 `cli issue create --project ID --title TITLE --description TEXT --labels 想法池 --status backlog`。工具将真实 CODEX_THREAD_ID 写入来源关联。已有记录补充可用 `cli comment add ID --body TEXT`，具体语法核对 references/cli.md。
6. 返回成功后才简短告知“已记入想法池：……”，并继续当前工作，不因记录打断主线。失败要如实说明；不能仅口头说已记下。

本规则由加载该 Skill 的 Codex 对话执行，不是全局后台监听。新对话需加载更新后的插件；项目归属明确后可在后续轮次沿用。面板的“添加想法”是另一条独立入口，手工保存与对话保存使用同一项目数据。

## 持续更新

- 已使用图谱的长线任务：开始阶段前读取进度；计划变化或阶段结束时同步。用户发散时把新点作为子任务或想法池记录，保留其他阶段与总目标。
- `cli issue get ID` 读取最新 version；`cli issue move ID --status in_progress --if-version VERSION` 更新状态。执行后自验通过通常进入 in_review；用户明确认可或指示标记完成后才进入 done。不要因生成方案就标为完成。
- 状态：backlog、todo、in_progress、in_review、blocked、done、canceled。
- 依赖：`cli issue relation add ID --type blocked_by --issue PREDECESSOR_ID --if-version VERSION`。父子关系与前置依赖不同，勿自动把所有阶段串成依赖链。
- 通过 `cli issue create --project ID --title TEXT --labels 想法池` 暂存分支想法。纳入主线时先读取完整 labels，去掉“想法池”标签再更新，并按实际需要添加父任务关系。
- 更新已有用户手建任务时直接用 cli，而不是再用 sync 创建一个同名节点。
- 更多命令参见 `references/cli.md`，将其中 taskctl 替换为上面的命令前缀加 `cli`。
- 写操作从 CODEX_THREAD_ID 自动关联当前对话；未提供时使用真实的 `--thread-id`，不得编造。

图谱点击“聚焦”只改变查看位置；状态只在用户选择状态或代理执行更新命令时改变。数据存于本机 SQLite，视图的折叠和聚焦存于浏览器。不宣称所有对话后台实时监听或自动扫描。
