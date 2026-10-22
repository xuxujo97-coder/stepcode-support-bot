<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/configuration/environment 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/configuration/environment

# 环境变量

环境变量用于标记 Step Code 子进程、控制权限与多代理，以及在 CI 或容器中临时注入模型配置。设置后请从同一终端启动 Step Code。

## 供应商凭证

各供应商使用自己的 API Key 环境变量，例如 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY`，常用供应商列表见[登录与模型](/docs/zh/step-code/configuration/models#api-key-供应商)。

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
export STEP_API_KEY="YOUR_STEP_API_KEY"
```

将 `YOUR_STEP_API_KEY` 替换为实际密钥；请勿提交真实密钥。保存的账号及自定义模型配置也会影响所用凭据，排查方法见[登录与模型](/docs/zh/step-code/configuration/models)。

静态托管插件 steppage 使用 `STEPFUN_API_KEY`，请保留工具要求的变量名。

`STEP_BASE_URL` 指定阶跃模型服务基础地址，按账号地区和计费通道选择，见[阶跃 API 端点](/docs/zh/step-code/configuration/models#阶跃-api-端点)。

## 运行时开关

| 变量 | 说明 |
| - | - |
| `STEP_PERMISSION_PRESET`、`STEP_APPROVAL_MODE` | 覆盖权限模式，见[权限与安全](/docs/zh/step-code/guides/permissions#权限模式) |
| `STEP_DISABLE_WORKFLOW` | 设置为 `1` 关闭 workflow / ultraloop 注册 |

## 数据与计划目录

| 变量 | 用途 |
| - | - |
| `STEP_CODING_AGENT_DIR` | Agent 资源根目录，其父目录保存配置、凭据和模型文件 |
| `STEP_CODING_AGENT_SESSION_DIR` | 会话目录 |
| `STEP_CODING_AGENT_PLAN_DIR` | 新计划文件目录，可放到工作区外；相对路径按工作目录解析，已有会话仍沿用保存的计划路径，不自动搬迁 |

目录结构见[数据路径](/docs/zh/step-code/configuration/data-paths)。

## 用环境变量注入模型

| 变量 | 说明 |
| - | - |
| `STEPCODE_CONFIG_PATH` | 指向 JSON 模型配置，启动时注入模型目录 |
| `STEP_API_KEY` | 内置 `step` 平台的密钥变量 |
| `STEP_MAX_CONTEXT_TOKENS` | 覆盖注入模型的上下文窗口 |
| `STEP_MAX_OUTPUT_TOKENS` | 覆盖注入模型的最大输出 |

`STEPCODE_CONFIG_PATH` 保存模型和权限偏好时会写回该 JSON 文件，而不是 `models.json`；不要将其视为只读临时模型目录。

适合 CI、容器等场景临时接入模型端点。请在注入配置中明确所需的模型能力与兼容选项，并按服务端支持的参数配置。

持久的自定义模型配置见[登录与模型](/docs/zh/step-code/configuration/models)。

## 代理

`HTTP_PROXY` / `HTTPS_PROXY` 配置出站代理，也可在全局 `config.toml` 设置 `httpProxy`。`NO_PROXY` 按主机名或后缀匹配绕过代理的目标。

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
export HTTPS_PROXY="http://127.0.0.1:7890"
export NO_PROXY="localhost,127.0.0.1"
step
```

将端口替换为实际代理端口。此例让回环请求不经过代理。

## 进程标记

| 变量 | 说明 |
| - | - |
| `AI_AGENT=step` | 通用进程标记，让外部工具识别进程由 Step Code 启动 |

该标记会被子进程继承；SDK 嵌入时不自动设置。

## 遥测

遥测使用全局 `config.toml` 配置，开关见[配置文件](/docs/zh/step-code/configuration/files#遥测)。模型请求与主动反馈分别管理。

<a id="下一步" />
