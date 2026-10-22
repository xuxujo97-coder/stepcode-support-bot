<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/guides/migration 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/guides/migration

# 从其他工具迁移

Step Code 可以接入 Claude Code / Codex 的现有工作流：首次启动导入 MCP 配置，兼容 Claude Code 插件布局，现有 `CLAUDE.md` 直接生效。登录凭据需要重新配置。

<a id="迁移会发生什么" />

## 迁移范围

首次启动检测到本机 Claude Code 或 Codex 的 MCP 配置时，会显示导入界面。确认后，支持的服务器配置写入 `~/.stepcode/config.toml` 的 `[mcp_servers]`。

* 来源包括 `~/.claude.json` 和 `~/.codex/config.toml`。
* 源文件只读，不移动、删除或覆盖原配置。
* 每个来源只询问一次；重复内容不重复导入。
* 同名但配置不同的服务器自动加 `-claude` / `-codex` 后缀。
* 环境变量引用保留变量名，不将对应环境变量值展开写入配置。
* 无法转换的字段会提示，导入后需检查结果。

目前支持 stdio 和 Streamable HTTP；SSE、WebSocket 传输及 IDE 注入的服务器不自动导入。Claude Code 项目级 `mcpServers` 需要手动配置。

## MCP 配置自动导入

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step mcp list
step mcp get <服务器名称>
```

在交互界面使用 `/mcp` 检查连接状态和工具数。命令路径、环境变量和远程服务权限仍需在 Step Code 的运行环境中有效。

原工具与 Step Code 可以并存；导入后，两份配置各自独立，不自动同步。

服务器管理和鉴权见[MCP](/docs/zh/step-code/customization/mcp)。

## 直接使用 Claude Code 插件

Step Code 可读取 `.claude-plugin/plugin.json`，以及插件中的 `.mcp.json`、`skills`、`commands` 和 `agents`。市场清单兼容 `.claude-plugin/marketplace.json`。

安装后，请检查需要使用的 Skills 和 MCP 功能。安装方式见[插件与 Packages](/docs/zh/step-code/customization/plugins)。

## 复用已有 Skills

用户目录增加 `~/.claude/skills`、`~/.stepcode/skills`；项目目录增加受信任扫描范围内的 `.claude/skills`。Claude 目录自动发现，不必重复加入 `skills` 数组；`~/.codex/skills` 等非默认目录仍需显式指定。

## 项目指引文件

现有 `CLAUDE.md` 可以继续使用。请检查其中的命令、工具名称和路径是否适用于 Step Code；通用创建方法、加载范围与优先级见[项目指引](/docs/zh/step-code/customization/project-instructions)。修改后运行 `/reload` 或重启。

## 不迁移的内容

| 内容 | 处理方式 |
| - | - |
| 模型供应商凭据 | Step 账号重新执行 `/login`；其他供应商按[登录与模型](/docs/zh/step-code/configuration/models)配置 |
| MCP OAuth 授权 | 执行 `step mcp login <名称>` |
| 源工具项目级 MCP 配置 | 按需手动添加 |

不要直接复制不明格式的凭据文件，也不要将包含密钥的配置提交到项目仓库。

安装与登录步骤见[快速开始](/docs/zh/step-code/quickstart)。

## 验证迁移结果

1. 完成一次模型对话，确认所选账号和模型可用。
2. 在 `/mcp` 中检查已导入服务器，并验证实际需要的工具调用。
3. 核对项目指引与资源路径，确认原工具的配置仍保留。
