<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/guides/permissions 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/guides/permissions

# 权限与安全

权限模式控制 Step Code 执行工具前的审批方式。处理项目时，还需分别确认项目资源、模型服务和外部工具的访问范围。

## 权限模式

从 v0.1.4 起，交互界面提供以下模式：

| 模式 | 行为 |
| - | - |
| Ask | 修改文件或运行命令前询问 |
| Approve for Me（默认） | 常规操作自动执行；检测到危险或无法完整分析的命令、以及关键决策仍需确认 |
| Full Access | 确认风险后可直接执行风险命令，不再逐次确认；为个别工具设置的禁止或确认规则仍然生效 |

两个自动档默认启用模型错误后的自动重试，重试次数有上限。

Ask 和 Approve for Me 对检测到的危险或无法完整分析的命令要求确认。Full Access 在风险确认后跳过这类逐次确认；为个别工具设置的禁止或确认规则仍然生效。规则检查不能覆盖任意脚本或所有危险行为，不能作为沙箱使用。

## 选择权限模式

<Warning>
  Full Access 允许直接执行风险命令。开启前，请确认工作目录、可访问的凭据与文件范围，并备份重要数据。
</Warning>

未取得风险确认不会进入 Full Access；没有交互界面的运行不会仅凭配置获得 Full Access。权限模式不是系统沙箱。

1. 在交互输入框中运行 `/permissions`。
2. 根据任务选择模式。首次处理项目时，建议选择 Ask，检查工具参数后再批准操作。
3. 工作范围变化时，重新检查当前模式。也可以使用 Shift+Tab 或 `/permissions cycle` 切换。

Ask 模式的批准或拒绝针对对应的工具调用。拒绝后，该调用取消，模型收到拒绝原因；批量调用可能分别请求确认。

## 信任项目资源

项目信任决定是否加载项目配置、扩展和资源。使用 `/trust` 管理信任；命令行的 `--approve` 和 `--no-approve` 控制本次是否加载需要信任的项目资源。

信任项目前，请检查 `.stepcode/` 中的配置与资源。项目指引的加载范围见[项目指引](/docs/zh/step-code/customization/project-instructions)，配置覆盖关系见[配置文件](/docs/zh/step-code/configuration/files)。

## 限制工具范围

只需要分析项目时，选择 Ask，并在任务中说明文件范围。需要限制可用工具时，使用 `--tools` 或 `--exclude-tools`，工具名称应与当前注册的工具一致，见[内置工具](/docs/zh/step-code/reference/tools)。

`defaultTools` 管理原生内置工具集合；Step 工具、扩展与 MCP 工具还需按各自配置处理。MCP 可通过 `enabled_tools` 和 `disabled_tools` 筛选工具，见[MCP](/docs/zh/step-code/customization/mcp#工具命名与过滤)。

权限模式和工具筛选不提供操作系统级隔离。处理不可信代码或要求限制文件、网络访问的任务时，请使用容器、虚拟机或操作系统权限。

## 设置非交互任务的审批策略

`step -p` 没有交互审批界面。通过 `--approval-mode` 和 `--non-interactive-approval` 设置任务的审批策略，并明确可用工具。参数格式见 [`step` 命令](/docs/zh/step-code/reference/cli)。

`--non-interactive-denial` 控制遇到需人工确认的操作被拒绝后的行为：默认 `terminate` 终止任务；`continue` 将失败原因返回模型，由其尝试其他方式。继续执行仍受所选权限限制。

## 保护数据与凭据

* 模型请求会发送提示词、相关文件和工具结果。提供材料前，请确认服务有权接收这些数据。
* MCP 与插件可能执行本地程序或访问外部服务。只加载可信来源，并使用最小必要凭据。
* 日志和导出的会话可能包含代码、路径或错误详情，分享前请审查。
* 部署会上传构建产物，执行前请检查其中的密钥、私有配置和用户数据。

本地文件位置与清理方法见[数据路径](/docs/zh/step-code/configuration/data-paths)；发布前的检查见[发布 StepPage](/docs/zh/step-code/reference/steppage)。
