<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/configuration/models 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/configuration/models

# 登录与模型

Step Code 支持订阅账号登录、API Key 和云平台，也可以通过 `models.json` 接入 OpenAI / Anthropic / Google 兼容端点，例如 Ollama、vLLM 和 LM Studio。

## 接入方式

| 方式 | 设置入口 |
| - | - |
| Step 账号登录 | `/login` 选择阶跃账号入口并完成授权 |
| API Key | 阶跃密钥可通过 `/login` 配置；其他供应商使用环境变量或自定义平台配置 |
| 云平台 | Azure OpenAI、Amazon Bedrock、Google Vertex AI、Cloudflare |
| 自定义模型 | `~/.stepcode/models.json` |

排查凭据时，请检查命令行 `--api-key`、已保存的 `auth.json`、`models.json` 中的平台配置及进程环境变量。使用同一平台的多个配置来源时，先确认实际选中的账号和端点。

## 订阅登录

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
/login
```

阶跃账号选择 Step Plan（国内）或 Step Plan Oversea（海外）。OAuth 凭据会按登录流程刷新；使用 `/logout` 清除相应凭据。

| 平台 | 登录网站 | 计费通道 |
| - | - | - |
| Step Plan | `platform.stepfun.com` | 国内 Step Plan |
| Step Plan Oversea | `platform.stepfun.ai` | 海外 Step Plan |
| 国内开放平台 API Key | `platform.stepfun.com/interface-key` | 按量付费 |
| 海外开放平台 API Key | `platform.stepfun.ai/interface-key` | 按量付费 |

选择错误通道不会因为已有订阅而自动改用订阅额度。可用模型和额度取决于账户权限，套餐规则见 [Step Plan](/docs/zh/step-plan/overview)。

在 SSH、服务器或容器终端中登录的方式见[远程登录](#远程登录)。

## 阶跃 API 端点

通过环境变量配置阶跃 API Key 时，同时指定与账号匹配的 `STEP_BASE_URL`：

| 账号与通道 | 基础地址 |
| - | - |
| 国内 Step Plan | `https://api.stepfun.com/step_plan/v1` |
| 海外 Step Plan | `https://api.stepfun.ai/step_plan/v1` |
| 国内开放平台按量付费 | `https://api.stepfun.com/v1` |
| 海外开放平台按量付费 | `https://api.stepfun.ai/v1` |

国内 Step Plan 的 Bash 示例：

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
export STEP_API_KEY="YOUR_STEP_API_KEY"
export STEP_BASE_URL="https://api.stepfun.com/step_plan/v1"
step --provider step
```

请妥善保管 API Key，不要写入仓库或分享给他人。获得该 Key 的人可以使用您的账号调用模型并产生用量。

## API Key 供应商

| 供应商 | 环境变量 |
| - | - |
| Step | `STEP_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Kimi For Coding | `KIMI_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| xAI | `XAI_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |

例如，在 Bash 或 Zsh 中配置 Anthropic：

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
export ANTHROPIC_API_KEY="YOUR_ANTHROPIC_API_KEY"
step --provider anthropic
```

占位符须替换为对应供应商的密钥，不能将 Step 密钥用于其他供应商。通过阶跃登录保存的密钥位于 `~/.stepcode/auth.json`，请勿提交到代码仓库。

运行时环境变量配置见[环境变量](/docs/zh/step-code/configuration/environment)。

## 云平台

| 平台 | 配置要求 |
| - | - |
| Amazon Bedrock | `AWS_PROFILE` 或 `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`；`AWS_REGION` 默认 `us-east-1`；支持 ECS task roles 和 IRSA |
| Google Vertex AI | 运行 `gcloud auth application-default login`，设置 `GOOGLE_CLOUD_PROJECT` 和 `GOOGLE_CLOUD_LOCATION`（如 `us-central1`） |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_BASE_URL`，根端点自动归一到 `/openai/v1`；`AZURE_OPENAI_DEPLOYMENT_NAME_MAP` 映射部署名 |

云平台的模型部署名、可用区域和 IAM 权限由该平台管理。请先确认账户可调用目标模型，再在 Step Code 中选择。

## 自定义模型（models.json）

编辑 `~/.stepcode/models.json`，重新打开 `/model` 加载变更。以下示例接入本地 Ollama：

```json theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        {"id": "llama3.1:8b"},
        {"id": "qwen2.5-coder:7b"}
      ]
    }
  }
}
```

先在 Ollama 中准备对应模型。这里的 `ollama` 是本地服务的非空 `apiKey` 占位值；本地无鉴权服务也需要该字段，才能出现在 `/model` 中。远程鉴权服务必须填写其实际凭据。

| 平台字段 | 说明 |
| - | - |
| `baseUrl` | OpenAI 兼容端点包含 `/v1`；`google-generative-ai` 填到 `/v1beta` 根 |
| `api` | 如 `openai-completions`、`openai-responses`、`azure-openai-responses`、`anthropic-messages`、`google-generative-ai` |
| `apiKey`、`headers` | 凭据和附加请求头 |
| `models` | 自定义模型列表 |
| `modelOverrides` | 覆盖已有模型属性 |
| `compat` | 调整兼容请求行为，按服务端支持设置 |

模型字段包括 `id`、`name`、`reasoning`、`contextWindow`、`maxTokens`、`cost`、`thinkingLevelMap` 和 `samplingParams`。`id` 必填，`contextWindow` 默认 128,000，`maxTokens` 默认 16,384；可按模型规格覆盖。

`samplingParams` 用于 OpenAI 兼容请求的采样参数合并，可能覆盖同名请求字段。不要添加服务端不支持的字段。仅覆盖 `baseUrl` 可以修改内置平台端点，提供 `models` 则按模型 ID 更新或添加。

Ollama / vLLM / SGLang 常需在 `compat` 中设置 `supportsDeveloperRole = false` 和 `supportsReasoningEffort = false`。

模型加载和登录问题见[常见问题](/docs/zh/step-code/reference/faq)。

## 切换模型

* `/model` 打开模型选择器，Ctrl+S 保存为启动默认。
* Ctrl+P 在 `enabledModels` 中循环选择，反向快捷键见[键盘快捷键](/docs/zh/step-code/reference/keyboard-shortcuts)。
* 命令行使用 `step --provider <平台> --model <模型 ID>`。
* `/effort` 调整思考级别；可选级别和执行档位由模型决定。

默认模型的配置字段见[配置文件](/docs/zh/step-code/configuration/files)。

## 远程登录

在 SSH、服务器或容器终端中，可运行 `step login --no-browser` 获取授权链接，在本机或其他设备的浏览器中完成登录。该命令仍要求交互终端，不依赖本地回调端口。
