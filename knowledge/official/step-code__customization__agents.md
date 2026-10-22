<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/customization/agents 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/customization/agents

# Agent 与 subagent

Step Code 提供四个内置子代理角色，并支持使用 Markdown 文件定义自定义 Agent，通过 workflow 编排多代理并行任务。

## 内置 agent

| 角色 | 职责 | 工具范围 |
| - | - | - |
| `general` | 通用实现任务 | 全部工具 |
| `explore` | 只读仓库侦察 | `read_file`、`find_files`、`search_files`、`list_directory` |
| `review` | 正确性与回归审查 | 只读工具和命令执行 |
| `planner` | 调查并制定实施计划 | 只读工具和命令执行 |

子代理不直接与用户对话，结果返回主代理。具备命令执行能力的角色仍可执行写入操作，实际行为受工具权限约束。

## subagent 工具

### single、parallel 与 chain

| 模式 | 行为 |
| - | - |
| single | 一个角色处理一个任务 |
| parallel | 多个任务并行执行 |
| chain | 顺序执行，后续任务通过 `{previous}` 引用前一步结果 |

您可以通过自然语言授权主代理使用这些能力：

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
请并行委派两个只读任务：一个检查 API 错误处理，一个检查对应测试覆盖。分别返回证据和建议，由主代理汇总，不修改文件。
```

### 后台 lane

后台任务需保持 Step Code 进程运行。

后台任务的完成通知会返回主代理；需要停止任务时，请明确指定对应的任务。

## workflow 与 ultraloop

workflow 在无网络、无文件系统的沙箱 VM 中运行 JavaScript 编排脚本，提供 `phase()`、`parallel()`、`pipeline()`、`agent()` 和 `iterate()` 原语。运行记录保存在项目 `.stepcode/workflows/runs/`，支持断点续跑，使用 `/workflows` 查看已保存的 workflow 与近期运行。

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
ultraloop 按模块审查测试覆盖。各子代理只检查分配的目录，返回缺失场景；主代理去重并给出补测计划。
```

多代理调用要求显式授权，该要求通过提示词约束；未授权调用会被记录，但不会在执行层被拦截。在消息中使用 `ultraloop` 或 `ultracode`，或使用 `/ultraloop on` 开启会话级授权、`/ultraloop off` 关闭。单条消息的授权不自动延续，也不从任务规模推断。

`STEP_DISABLE_WORKFLOW=1` 禁用注册。

多代理任务示例见[常见使用案例](/docs/zh/step-code/guides/use-cases)。

`/ultracode [on|off|status|help]` 管理多代理协作，`/ultraloop` 为别名；`/workflows` 查看工作流与运行记录。开关按会话保存，恢复同一会话会恢复状态，没有保存状态的新会话默认关闭。

## 自定义 agent

使用 Markdown frontmatter 定义角色，正文作为系统指令：

```markdown theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
---
name: db-migrator
description: 设计可回滚的数据库迁移方案并审查迁移脚本
tools: read_file, run_command, edit_file
---

先检查现有迁移约定，再制定方案。所有迁移必须提供回滚步骤。
未经明确授权，不连接生产数据库，不执行生产迁移。
```

| 项目 | 说明 |
| - | - |
| 用户目录 | `~/.stepcode/agent/agents/*.md` |
| 项目目录 | `.stepcode/agents/` |
| 必填字段 | `name`、`description` |
| 可选字段 | `tools`、`model` |
| 同名优先级 | 项目覆盖用户，用户覆盖内置 |

`tools` 可以使用数组或逗号分隔列表。项目角色需显式纳入发现范围，调用时通过 `agentScope: "both"` 启用，并按提示确认。

专项工作流的定义见[Agent Skills](/docs/zh/step-code/customization/skills)。

通过插件分发 Agent 的方式见[插件与 Packages](/docs/zh/step-code/customization/plugins)。

## 上下文隔离与安全

沙箱 VM 的限制仅作用于 workflow 编排脚本，子任务进程仍受操作系统权限控制。

* 子代理拥有独立上下文和用量，主代理主要接收结果摘要。
* 子代理可能与主代理共享工作目录，文件修改会作用于同一工作树。
* 并行写入时应划分互不重叠的文件，或明确安排独立 Git worktree。
* Git worktree 只隔离工作树，不限制其他目录、网络或凭据访问。
* 完成后先检查差异和测试，再合并结果；未合并改动不要直接清理。

默认规模为 medium（约 15 个 Agent 以内），除非明确要求扩大。
通用审批与访问边界见[权限与安全](/docs/zh/step-code/guides/permissions)。
