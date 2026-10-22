<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/reference/cli 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/reference/cli

# step 命令

在终端中使用 `step` 启动会话，或通过子命令管理安装、资源包和 MCP。

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step [选项] [--] [@文件...] [任务描述...]
```

查看当前版本提供的参数：

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step --help
step --version
```

## 模型参数

| 参数 | 说明 |
| - | - |
| `--provider <名称>` | 平台名称，如 `step`、`anthropic`、`openai` |
| `--model <模型>` | 模型 ID 或匹配模式，支持 `provider/id` 和思考级别后缀 |
| `--api-key <密钥>` | 覆盖其他凭据来源；注意 Shell 历史和进程参数暴露风险 |
| `--thinking <级别>` | `off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`，需模型支持 |
| `--models <列表>` | Ctrl+P 循环模型列表，逗号分隔 |
| `--list-models [搜索词]` | 列出可用模型 |

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step --provider step --model step-3.7-flash
step --list-models flash
```

模型切换的完整快捷键见[键盘快捷键](/docs/zh/step-code/reference/keyboard-shortcuts)。

## 会话参数

| 参数 | 说明 |
| - | - |
| `-c`、`--continue` | 继续最近一次会话 |
| `-r`、`--resume` | 浏览并选择历史会话，可附带路径或 ID |
| `--session <路径或 ID>` | 指定会话，支持部分 ID |
| `--fork <路径或 ID>` | 派生指定会话 |
| `--session-dir <目录>` | 自定义会话目录 |
| `--no-session` | 不保存本次会话 |
| `--name <名称>`、`-n <名称>` | 设置会话名称 |
| `-p`、`--print` | 执行一次任务并退出，支持 stdin 和 `@文件` |

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step --name "接口审查" @README.md "梳理接口约定"
step -p @screenshot.png "解释这张截图中的错误"
step --no-session -p "解释语义化版本号"
```

交互界面的会话管理命令见[斜杠命令](/docs/zh/step-code/reference/slash-commands)。

## 工具参数

| 参数 | 说明 |
| - | - |
| `--tools <列表>`、`-t <列表>` | 工具白名单，逗号分隔；作用于内置和扩展工具 |
| `--exclude-tools <列表>`、`-xt <列表>` | 排除工具 |
| `--no-builtin-tools`、`-nbt` | 关闭内置工具，保留扩展工具 |
| `--no-tools`、`-nt` | 关闭所有工具 |

例如，传入已有的 README，且不启用工具：

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step --no-tools -p @README.md "概括这个 README 中的项目用途"
```

权限与危险操作说明见[权限与安全](/docs/zh/step-code/guides/permissions)。

## 资源参数

| 参数 | 说明 |
| - | - |
| `-e <来源>`、`--extension <来源>` | 临时加载扩展，可重复 |
| `--skill <路径>` | 显式加载 Skill，可重复 |
| `--prompt-template <路径>` | 加载 prompt 模板，可重复 |
| `--theme <路径>` | 加载主题资源，可重复 |
| `--no-extensions`、`--no-skills`、`--no-prompt-templates`、`--no-themes` | 关闭对应资源的自动发现 |
| `--no-context-files`、`-nc` | 不自动加载项目指引 |

显式指定的资源可与关闭自动发现的选项配合使用；它们仍需来自可信来源。

持久资源配置见[配置文件](/docs/zh/step-code/configuration/files)。

## 自动化与上下文

| 参数 | 说明 |
| - | - |
| `--mode <模式>` | 选择输出或集成模式：`text`、`json` 或 `rpc`；`rpc` 用于集成，不等同普通文本输出 |
| `--context-projection <模式>` | 设置本次上下文模式：`clm-v1`（默认）、`lightweight-v1` 或 `off` |
| `--completion-check git-committed` | 仅 print/JSON 模式；检查提交、工作区状态和最终答复 |
| `--completion-check-attempts <1..3>` | 最多追加轮次，默认 2；需同时启用完成检查 |
| `--completion-review` | 请求自查；依赖完成检查，与其共用追加轮次 |
| `--non-interactive-approval <模式>` | 无人工审批界面时的策略：`allow` 或 `deny` |
| `--non-interactive-denial <模式>` | 被拦截后的处理：`terminate`（默认）终止，或 `continue` 将原因返回模型继续处理 |
| `--tool-override <工具=模式>` | 单个工具的策略，可重复；模式为 `allow`、`confirm` 或 `deny` |

完成检查不等于测试通过或代码质量保证；`continue` 不绕过权限。

## 其他参数

| 参数 | 说明 |
| - | - |
| `--plan` | 启动即进入 Plan 模式 |
| `--tui-mode <模式>` | `regular` 或实验性 `fullscreen` |
| `--approval-mode <模式>` | 工具审批模式，可选 `confirm` 或 `auto`，适用于交互和非交互运行 |
| `--version` | 查看版本 |
| `--use-theme <名称>` | 本次启动使用的主题 |
| `--export <会话文件> [输出文件]` | 导出会话为 HTML |
| `--` | 结束选项解析，其后作为消息或文件引用 |

## 子命令

| 命令 | 说明 |
| - | - |
| `step login --no-browser` | 在 SSH、服务器或容器终端中获取授权链接，在本机或其他设备的浏览器中完成登录；该命令仍要求交互终端，不依赖本地回调端口 |
| `step update` | 更新到最新稳定版，别名 `step upgrade` |
| `step update <版本号>` | 安装实际发行的指定版本 |
| `step install <来源>` | 安装资源包 |
| `step remove <来源>` | 移除资源包 |
| `step list` | 列出资源包 |
| `step config` | 可视化管理资源，Tab 切换全局与项目范围 |
| `step mcp` | MCP 的 `list`、`get`、`add`、`remove`、`login`、`logout` |
| `step mcp prepare` | 准备或重试内置可选资源（如 StepPage），准备后重启检查；不用于修复任意第三方 MCP 服务 |
| `step login`、`step logout` | Step 账号登录或退出 |
| `step login status` | 查看 Step 登录方式和状态 |

升级和卸载步骤见[升级](/docs/zh/step-code/installation)。
