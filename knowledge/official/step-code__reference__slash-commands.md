<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/reference/slash-commands 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/reference/slash-commands

# 斜杠命令

在 Step Code 交互输入框中输入 `/` 查看命令补全。以下命令在交互界面中执行，不是终端 Shell 命令。

## 会话

| 命令 | 作用 |
| - | - |
| `/new`、`/clear` | 新建会话 |
| `/resume` | 浏览并恢复历史会话 |
| `/name` | 设置会话名称 |
| `/session` | 查看会话路径、ID 和用量 |
| `/tree` | 浏览会话树 |
| `/fork` | 派生会话 |
| `/clone` | 复制当前分支到新会话 |
| `/export [文件]` | 导出 HTML 或 JSONL |
| `/import <文件>` | 导入 JSONL |
| `/copy` | 复制响应内容 |

会话分支与文件修改的关系见[会话与上下文](/docs/zh/step-code/guides/sessions)。

命令行启动与恢复会话的参数见[`step` 命令](/docs/zh/step-code/reference/cli)。

## 模型与思考

| 命令 | 作用 |
| - | - |
| `/model` | 选择模型，Ctrl+S 保存默认值 |
| `/effort` | 选择思考级别，按 Enter 应用并保存默认值；`/effort <级别>` 同样保存 |
| `/scoped-models` | 管理 Ctrl+P 循环的模型集合 |
| `/llama` | 管理 llama.cpp 路由服务器模型 |

## 上下文与配置

| 命令 | 作用 |
| - | - |
| `/clm [status\|on\|off\|diff\|reset]` | 查看状态、切换当前会话开关、查看修改或清除整理结果 |
| `/clm-compact [要求]` | 主动请求模型整理上下文 |
| `/compact [保留要求]` | 使用原有摘要压缩 |
| `/settings` | 打开设置菜单 |
| `/reload` | 重载配置和资源 |
| `/theme [名称]` | 选择主题 |
| `/trust` | 管理项目信任 |

`/clm reset` 不撤销已经发生的原有摘要压缩。整理产生额外模型调用，用量计入会话统计。

配置字段的完整说明见[配置文件](/docs/zh/step-code/configuration/files)。

## 权限与模式

| 命令 | 作用 |
| - | - |
| `/permissions` | 选择工具审批模式 |
| `/permissions cycle` | 循环切换权限模式 |
| `/plan [任务]` | 切换 Plan 模式，或开始规划指定任务 |

## 长任务与多代理

| 命令 | 作用 |
| - | - |
| `/ultracode [on\|off\|status\|help]` | 管理多代理协作；`/ultraloop` 为别名 |
| `/workflows` | 查看工作流与运行记录 |
| `/goal <目标>` | 设置目标 |
| `/goal status` | 查看目标和状态 |
| `/goal pause`、`/goal resume` | 暂停或恢复目标 |
| `/goal edit <目标>` | 修改目标 |
| `/goal clear` | 清除目标 |
| `/cron` | 定时任务列表与删除 |
| `/todos` | 查看任务清单 |

目标模式用于持续推进长任务，多代理编排和授权方式见 [Agent 与 subagent](/docs/zh/step-code/customization/agents#workflow-与-ultraloop)。

Ultracode 开关按会话保存，恢复同一会话会恢复状态，没有保存状态的新会话默认关闭。

<a id="生态" />

## 扩展与项目指引

| 命令 | 作用 |
| - | - |
| `/plugin` | 插件和市场管理 |
| `/mcp` | 查看 MCP 服务状态 |
| `/init` | 生成项目指引 `AGENTS.md` |
| `/skill:<名称> [参数]` | 调用已加载的 Skill |

插件安装或卸载涉及 MCP 时，重启后再检查加载结果。

## 账号与其他

| 命令 | 作用 |
| - | - |
| `/login`、`/logout` | 平台登录或退出 |
| `/status` | 查看会话与模型状态 |
| `/hotkeys` | 查看快捷键 |
| `/feedback` | 提交反馈 |
| `/quit`、`/exit` | 退出 |

提交反馈前检查正文和附件是否含敏感数据。

完整快捷键列表见[键盘快捷键](/docs/zh/step-code/reference/keyboard-shortcuts)。
