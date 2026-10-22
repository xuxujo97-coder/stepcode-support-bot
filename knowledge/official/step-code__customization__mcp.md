<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/customization/mcp 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/customization/mcp

# MCP

MCP（Model Context Protocol）将本地或远程工具接入 Step Code。服务器连接后，模型可以按任务需要调用已注册的工具。

## 接入方式

| 传输 | 配置 | 适用场景 |
| - | - | - |
| stdio | `command`、`args`、可选 `env` | 启动本地工具进程 |
| Streamable HTTP | `url` | 连接远程 MCP 服务 |

不支持旧版 SSE 传输。插件也可以声明 MCP 服务器，安装和启用方式见[插件与 Packages](/docs/zh/step-code/customization/plugins)。

从其他工具导入已有配置的方式见[从其他工具迁移](/docs/zh/step-code/guides/migration)。

## 添加 MCP 服务

1. 确认本地服务的启动命令、参数与依赖，或远程服务的 URL 与鉴权要求。
2. 在 `~/.stepcode/config.toml` 的 `[mcp_servers.<名称>]` 中填写声明，字段格式见下方[配置](#配置)。修改已有配置时保留其他服务。
3. 完成对应鉴权后，重启 Step Code，并使用 `/mcp` 检查连接。

## 鉴权

Bearer token 应从运行 Step Code 的进程环境读取：

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
export EXAMPLE_TOKEN="YOUR_MCP_TOKEN"
step
```

OAuth 服务使用：

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step mcp login <服务器名称>
step mcp logout <服务器名称>
```

OAuth 使用动态客户端注册、PKCE 和本地回调。令牌保存在 `~/.stepcode/.credentials.json`，权限为 `0600`。模型平台登录与 MCP 服务授权是两套凭据。

## 交互内查看

运行 `/mcp` 查看服务器状态和已加载工具数。常见状态包括 `connecting`、`connected` 和 `failed`。`enabled = false` 的服务器不进入列表。

连接失败时，先检查命令是否存在、环境变量是否传入、远程地址是否可达，以及授权是否有效。

请再指定一次低风险工具调用，检查实际返回结果。连接状态用于确认服务连接，工具结果用于确认所需功能可用。

## 工具命名与过滤

工具以 `<服务器名>__<工具名>` 命名，非法字符转换为下划线。通过 `enabled_tools` 和 `disabled_tools` 在注册阶段过滤：设置 `enabled_tools` 后，其他工具对模型不可达。

## 配置

在全局 `~/.stepcode/config.toml` 的 `[mcp_servers.<名称>]` 中声明服务器。项目级 MCP 来自已安装插件 manifest 的 `mcpServers` 叠加：

```toml theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
[mcp_servers.local-tools]
command = "node"
args = ["/absolute/path/to/mcp-server.js"]
env = { LOG_LEVEL = "info" }

[mcp_servers.remote]
url = "https://mcp.example.com/mcp"
bearer_token_env_var = "EXAMPLE_TOKEN"

[mcp_servers.remote.oauth]
callback_port = 8976
```

示例中的本地路径和远程地址需替换为实际服务；Bearer 与 OAuth 按服务要求选择，不必同时配置。

| 字段 | 说明 |
| - | - |
| `command` | stdio 启动命令，与 `url` 二选一 |
| `args`、`env`、`cwd` | 命令参数、子进程环境变量和工作目录，按需填写 |
| `url` | Streamable HTTP 端点 |
| `bearer_token_env_var` | 保存 Bearer token 的环境变量名 |
| `http_headers` | 字面请求头，避免直接写入真实密钥 |
| `env_http_headers` | 请求头对应的环境变量名，缺少变量时报告错误 |
| `startup_timeout_sec` | 启动超时，默认 30 秒 |
| `tool_timeout_sec` | 单次调用超时，默认 300 秒 |
| `enabled` | 是否启用，默认 `true` |
| `enabled_tools`、`disabled_tools` | 启用或禁用的工具集合 |

全局配置文件说明见[配置文件](/docs/zh/step-code/configuration/files)。

## 命令行管理

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step mcp list
step mcp list --json
step mcp get <服务器名称>
step mcp add remote --url https://mcp.example.com/mcp
step mcp add local-tools -- node /absolute/path/to/mcp-server.js
step mcp remove <服务器名称>
```

`--url` 与本地命令互斥。`--bearer-token-env-var` 只用于 HTTP，`--env` 设置的是 stdio 子进程环境，并不是 HTTP 请求头。

## 安全性

stdio 服务会启动本地进程，远程服务会收到调用参数；服务返回内容也可能进入模型上下文。连接前请确认来源与访问范围，并关闭不需要的工具。通用审批规则见[权限与安全](/docs/zh/step-code/guides/permissions)。
