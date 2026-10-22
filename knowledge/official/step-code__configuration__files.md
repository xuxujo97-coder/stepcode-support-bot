<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/configuration/files 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/configuration/files

# 配置文件

使用 `config.toml` 设置默认模型、权限、上下文压缩、界面和 MCP 服务器。临时启动参数不会自动改写配置文件。

## 配置文件位置

| 级别 | 默认位置 | 作用 |
| - | - | - |
| 全局 | `~/.stepcode/config.toml` | 对所有项目生效 |
| 项目 | `<项目>/.stepcode/config.toml` | 覆盖全局设置，需要项目信任 |

项目配置按字段覆盖全局配置：嵌套对象逐键合并，数组整体替换。代理、项目信任默认值等标为“仅全局”的配置不接受项目级覆盖。

全局配置在首次运行时自动创建。写入使用临时文件加改名的原子替换方式，并保留文件头注释块。TOML 不支持 `null`，不支持的表达会被剥离；取消可选值时应删除对应配置项。

<a id="完整示例" />

其他本地数据的位置见[数据路径](/docs/zh/step-code/configuration/data-paths)。

### 外部 JSON 注入配置

`STEPCODE_CONFIG_PATH` 指向外部 JSON 配置。保存模型和权限偏好时会写回该 JSON 文件，而不是 `models.json`；不要将其视为只读临时模型目录。

## 配置示例

```toml theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
theme = "step-blue"
defaultProvider = "step"
defaultModel = "step-3.7-flash"
permissionPreset = "approve-for-me"
autoResume = true

[telemetry]
enabled = true
```

示例使用 Approve for Me 权限模式；需要修改文件和运行命令前确认时，将 `permissionPreset` 改为 `"ask"`。各权限模式的行为见[权限与安全](/docs/zh/step-code/guides/permissions)。

## 顶层字段

### 模型与思考

| 字段 | 说明 |
| - | - |
| `defaultProvider`、`defaultModel` | 默认平台和模型，可在 `/model` 中按 Ctrl+S 保存 |
| `defaultThinkingLevel` | 默认思考级别 |
| `modelThinkingLevels` | 按 `provider/modelId` 设置单个模型的思考级别 |
| `thinkingBudgets` | 各思考级别的 token 预算 |
| `hideThinkingBlock` | 隐藏思考块展示，默认 `false` |
| `showCacheMissNotices` | 显示缓存未命中和压缩成本提示，默认 `false` |

客户端级别包括 `off`、`minimal`、`low`、`medium`、`high`、`xhigh` 和 `max`。可用级别及其实际行为取决于供应商和模型。

平台接入与模型选择见[登录与模型](/docs/zh/step-code/configuration/models)。

### 界面

| 字段 | 默认值 | 说明 |
| - | - | - |
| `theme` | `step-blue` | 主题名称；选择与创建方法见[自定义主题](/docs/zh/step-code/customization/themes) |
| `statusTips` | `true` | 每轮显示一条工作行提示，设为 `false` 可关闭 |
| `quietStartup` | `false` | 精简启动信息 |
| `collapseChangelog` | `false` | 折叠更新日志 |
| `doubleEscapeAction` | `tree` | 空输入框连续按 Esc 的动作：`tree`、`fork`、`none` |
| `treeFilterMode` | `default` | `default`、`no-tools`、`user-only`、`labeled-only`、`all` |
| `editorPaddingX` | `0` | 输入框水平内边距，范围 0–3 |
| `outputPad` | `1` | 输出水平留白，取 0 或 1 |
| `autocompleteMaxVisible` | `5` | 补全菜单显示数量，范围 3–20 |
| `showHardwareCursor` | `false` | 显示终端硬件光标 |
| `externalEditor` | 未设置 | 外部编辑器；未设置时依次读取 `VISUAL`、`EDITOR` |

关闭工作行提示：

```toml theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
statusTips = false
```

<a id="会话、网络与-shell" />

### 会话与网络

| 字段 | 默认值 | 说明 |
| - | - | - |
| `sessionDir` | 未设置 | 自定义会话存储目录 |
| `transport` | `auto` | 模型传输方式：`auto`、`sse`、`websocket`、`websocket-cached`，需供应商支持 |
| `steeringMode`、`followUpMode` | `one-at-a-time` | 流式期间消息投递方式 |
| `httpProxy` | 未设置 | 出站代理，仅全局 |
| `httpIdleTimeoutMs` | 300,000 | HTTP 空闲超时，单位毫秒；0 关闭 |
| `websocketConnectTimeoutMs` | 15,000 | WebSocket 连接超时，单位毫秒；0 关闭 |

环境变量配置见[环境变量](/docs/zh/step-code/configuration/environment)。

### Shell 与命令

| 字段 | 默认值 | 说明 |
| - | - | - |
| `shellPath` | 未设置 | 自定义 Shell 路径，支持 `~` 展开，适用于 Windows Cygwin 等场景 |
| `shellCommandPrefix` | 未设置 | 在每条 Shell 命令前执行的内容，例如启用 alias |
| `npmCommand` | 未设置 | npm 调用命令，argv 形式，例如 `["mise", "exec", "node@20", "--", "npm"]` |

### 项目与权限

| 字段 | 说明 |
| - | - |
| `permissionPreset` | 默认 `approve-for-me`，可选 `ask`、`approve-for-me` 或 `full-access`；已保存的旧权限模式会重置为 Ask。模式通过 `/permissions` 选择，行为见[权限与安全](/docs/zh/step-code/guides/permissions) |
| `defaultProjectTrust` | 未信任项目的资源加载策略，默认 `ask`，仅全局 |
| `enableAnalytics` | 可选使用分析开关，默认 `false`；与反馈及其他服务设置分别管理 |

项目资源的加载与工具审批见[权限与安全](/docs/zh/step-code/guides/permissions)。

## 分节配置

```toml theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
[compaction]
enabled = true
reserveTokens = 16384
keepRecentTokens = 20000
contextProjection = "clm-v1"

[branchSummary]
reserveTokens = 16384
skipPrompt = false

[retry]
enabled = true
maxRetries = 3
baseDelayMs = 2000

[thinkingBudgets]
minimal = 1024
low = 4096
medium = 10240
high = 32768

[images]
autoResize = true
blockImages = false

[terminal]
showImages = true
imageWidthCells = 60
clearOnShrink = false
showTerminalProgress = false
hyperlinks = "auto"
images = "auto"
trueColor = "auto"

[markdown]
codeBlockIndent = "  "
mermaid = "streaming"
```

* `[compaction]` 的 `enabled = false` 只关闭自动压缩；`reserveTokens` 为预留窗口，`keepRecentTokens` 为保留的近期消息量。
* `[compaction].contextProjection` 未显式设置且自动压缩启用时默认为 `clm-v1`；`off` 只保留原有摘要压缩，不启用 CLM；`lightweight-v1` 为轻量投影。关闭自动压缩会同时关闭隐式 CLM。
* `[branchSummary].skipPrompt = true` 时切换分支不再询问，默认不生成摘要。
* `[retry]` 的 `baseDelayMs = 2000` 采用指数退避，等待 2、4、8 秒。`provider.maxRetries` 保持默认 `0`；设为正值会使 SDK 重试先于 Step 处理配额耗尽错误，可能等待至配额重置。`provider.timeoutMs` 可设置单请求超时。
* `[thinkingBudgets]` 配置各思考级别的 token 预算。
* `[images].autoResize = true` 将图片压缩到 2,000 px 以内。
* `[images].blockImages = true` 阻止向模型发送图片；`[terminal].showImages` 只控制显示。
* `[terminal].images` 可指定 `kitty`、`iterm2`、`auto` 或 `false`，应与终端能力匹配。
* `[terminal].imageWidthCells` 是行内图片的终端列宽；`clearOnShrink` 控制收缩时清理空行；`showTerminalProgress` 控制 OSC 9;4 进度指示；`hyperlinks` 可取 `true`、`false` 或 `"auto"`。
* `[markdown].mermaid` 可取 `streaming`、`final` 或 `off`。
* `[warnings].anthropicExtraUsage` 默认 `true`，控制 Claude Pro/Max 额外用量提示。

## MCP 服务器

`[mcp_servers.<名称>]` 声明全局 MCP 服务器。接入步骤、传输类型、鉴权和字段说明统一见[MCP](/docs/zh/step-code/customization/mcp)。

## 工具与资源数组

| 字段 | 作用 |
| - | - |
| `defaultTools` | 原生内置工具集合，如 `read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`；Step 和扩展工具的选择见[内置工具](/docs/zh/step-code/reference/tools) |
| `enabledModels` | Ctrl+P 循环选择的模型集合，支持 glob，例如 `["claude-*", "gpt-4o"]` |
| `packages` | 安装和加载的资源包 |
| `extensions`、`skills`、`prompts`、`themes` | 额外资源路径，支持 glob、排除和精确选择 |
| `enableSkillCommands` | 将 Skills 注册为 `/skill:<名称>`，默认 `true` |

资源数组可填写文件或目录，支持 glob、`!` 排除以及 `+path` / `-path` 精确控制。全局相对路径按 `~/.stepcode/agent` 解析，项目相对路径按项目 `.stepcode` 解析。工具启动参数见[内置工具](/docs/zh/step-code/reference/tools)。

## TUI 相关设置

| 字段 | 默认值 | 说明 |
| - | - | - |
| `tuiMode` | `regular` | 可选实验性 `fullscreen` |
| `fullscreenExitOutput` | `transcript` | 退出时显示会话记录，或选择 `resume-hint` |
| `fullscreenScrollbar` | `auto` | 可选 `always`、`hidden` |
| `fullscreenCopyOnSelect` | `true` | 选中即复制；关闭后可用 Ctrl+X |

## 废弃项

| 项目 | 说明 |
| - | - |
| `~/.stepcode/agent/settings.json` | 已退役，不再读写；旧设置手动迁移到 `config.toml` |
| `~/.stepcode/agent/step-settings.json` | 已退役 |
| `~/.stepcode/agent/auth.json`、`agent/models.json` | 旧位置，已上提到 `~/.stepcode` 根目录 |
| `.step-harness` | 已退役，不再写入；启动时仅读取旧凭据做一次性迁移 |

## 遥测

在全局 `config.toml` 中关闭遥测：

```toml theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
[telemetry]
enabled = false
```

此设置控制遥测；模型请求、MCP 调用和主动反馈分别管理。数据处理与分享要求见[权限与安全](/docs/zh/step-code/guides/permissions)。
