<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/configuration/data-paths 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/configuration/data-paths

# 数据路径

了解配置、凭据、会话和项目资源的存放位置，以便备份、迁移和排查问题。

## 数据根目录

| 系统 | 默认目录 |
| - | - |
| macOS | `/Users/<用户名>/.stepcode` |
| Linux | `/home/<用户名>/.stepcode` |
| Windows | `C:\Users\<用户名>\.stepcode` |

`~` 表示用户主目录，Agent 配置子目录为 `~/.stepcode/agent`。`.step-harness` 已退役，不再写入；启动时仅读取旧凭据做一次性迁移。

## 目录结构

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
~/.stepcode/
├── config.toml
├── auth.json
├── models.json
├── .credentials.json
├── device-id
├── models-store.json
├── bin/
├── logs/
├── marketplaces/
├── telemetry/
└── agent/
    ├── AGENTS.md
    ├── prompts/
    ├── skills/
    ├── agents/
    ├── themes/
    ├── extensions/
    ├── sessions/
    ├── trust.json
    ├── bin/
    ├── npm/
    └── git/
```

部分目录在首次使用对应功能时才创建。`bin/` 保存主程序和运行资源，`agent/bin/` 保存托管的搜索工具。

用户目录增加 `~/.claude/skills`、`~/.stepcode/skills`；项目目录增加受信任扫描范围内的 `.claude/skills`。Claude 目录自动发现，不必重复加入 `skills` 数组；`~/.codex/skills` 等非默认目录仍需显式指定。

## 关键文件

| 文件 | 内容 |
| - | - |
| `config.toml` | 全局设置和 MCP 服务器声明 |
| `auth.json` | API Key 与 OAuth 凭据；密钥值支持 `!command` 与 `$VAR` 取值 |
| `models.json` | 自定义模型和覆盖设置，打开 `/model` 时热重载 |
| `.credentials.json` | MCP OAuth 令牌 |
| `models-store.json` | 模型目录缓存 |
| `agent/trust.json` | 项目信任记录 |

凭据文件应限制为当前用户可读写。POSIX 环境使用 `0600` 权限；Windows 应检查对应账户的文件访问权限。不要将整个数据目录提交到 Git 或上传到公共网盘。

各配置字段的说明见[配置文件](/docs/zh/step-code/configuration/files)。

## 会话数据

会话位于 `agent/sessions/<编码后的工作目录>/`，每个会话使用一个 JSONL 文件，包含消息、工具调用、输出以及上下文摘要。使用 `/session` 查看当前文件的准确路径。

使用 `--session-dir` 指定会话目录；默认位置也可通过 `sessionDir` 或环境变量配置，以 `/session` 显示的路径为准。每条记录包含 `id` / `parentId`，当前位置为活跃叶子；压缩摘要、分支摘要、工具调用和输出都保存在同一文件中。

CLM 在会话目录下的 `live-context/<会话 ID>/` 维护工作副本（`mirror-*/LIVE_CONTEXT.md`）与归档（`archive/`）。没有会话文件时写入临时目录。它们与原始会话 JSONL 不是同一份文件。备份和清理时检查相关会话数据，不把归档全部当作短期缓存删除。

会话树和输入历史的使用见[会话与上下文](/docs/zh/step-code/guides/sessions)。不要直接编辑会话内部记录。

## 内置工具缓存

`rg`（ripgrep）和 `fd` 按需下载到 `~/.stepcode/agent/bin/`，Windows 对应 `rg.exe` / `fd.exe`。查找顺序为注入的自定义路径 > 已下载的本地副本 > 系统 PATH。

内容搜索的回退顺序为 ripgrep > `git grep`（搜索路径位于 Git 仓库时）> POSIX `grep`，全部不可用时报错。

删除该缓存后，下次使用可能重新下载。受限网络环境中请先检查系统 PATH 和下载访问权限。

## 日志

* `logs/`：运行日志，排查启动、连接或工具错误时优先查看。
* `telemetry/`：遥测缓冲，与会话记录分开保存。

日志可能包含错误详情和环境信息，分享前请审查。

模型调用、MCP、插件和部署会按操作需要访问外部服务。

遥测配置见[配置文件](/docs/zh/step-code/configuration/files#遥测)，代理与目录设置见[环境变量](/docs/zh/step-code/configuration/environment)。

## 项目级数据

| 位置 | 内容 |
| - | - |
| `.stepcode/config.toml` | 项目配置，需要项目信任 |
| `.stepcode/cron/tasks.json` | 持久定时任务 |
| `.stepcode/workflows/runs/` | workflow 运行记录 |
| `.stepcode/agents/`、`skills/`、`themes/`、`plugins/` | 项目自定义资源 |
| `.stepcode/plans/` | Plan 模式文件；`STEP_CODING_AGENT_PLAN_DIR` 可指定其他目录，相对路径按工作目录解析；已有会话仍沿用保存的计划路径，不自动搬迁 |
| `.stepcode/npm/` | 项目范围安装的 npm 包 |

可共享的配置和资源可按团队约定纳入版本管理；运行记录、缓存、私有路径和凭据应排除。不要直接将整个 `.stepcode/` 目录加入 Git。

## 清理数据

<Warning>
  删除项目 `.stepcode/` 会删除其中的配置、任务和自定义资源。
</Warning>

清理前退出 Step Code，并备份仍需使用的配置和会话。

| 需求 | 操作 |
| - | - |
| 重置配置 | 备份后移除 `config.toml` |
| 清理会话 | 删除不再需要的 `agent/sessions/` 内容 |
| 清理日志 | 删除旧的 `logs/` 文件 |
| 重新下载搜索工具 | 移除 `agent/bin/` 中对应工具 |
| 退出模型登录 | 使用 `/logout` |
| 清除 MCP 授权 | `step mcp logout <名称>` |
| 清理遥测缓冲 | 删除 `telemetry/`；这不会自动关闭遥测设置 |
| 刷新模型缓存 | 备份后移除 `models-store.json` |
| 彻底清理 | 备份后删除 Step Code 专用的数据目录，并清理安装器 PATH 项 |
