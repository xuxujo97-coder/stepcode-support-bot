<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/guides/sessions 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/guides/sessions

# 会话与上下文

Step Code 自动保存会话，支持恢复、分支导航、派生和导出。上下文接近模型窗口时，可通过压缩保留重要信息并继续工作。

## 启动与恢复会话

| 命令 | 作用 |
| - | - |
| `step` | 在当前目录新建会话 |
| `step -c` | 继续最近一次会话 |
| `step -r` | 浏览历史会话并选择恢复 |
| `step --session <路径或 ID>` | 恢复指定会话，支持部分 ID |
| `step --fork <路径或 ID>` | 从已有会话派生新会话文件 |
| `step --name "鉴权改造"` | 设置会话名称 |

Ultracode 开关按会话保存，恢复同一会话会恢复此前状态，没有保存状态的新会话默认关闭。可通过 `/ultracode status` 查看。

## 在 TUI 中切换会话

| 命令 | 作用 |
| - | - |
| `/new`、`/clear` | 新建会话，清空当前对话上下文 |
| `/resume` | 打开会话选择器 |
| `/name` | 为当前会话命名 |
| `/session` | 查看文件路径、ID、消息数、token 用量和成本信息 |
| `/fork` | 派生独立会话 |

会话选择器中可输入搜索词，Ctrl+S 切换排序，Ctrl+N 筛选命名会话，Ctrl+R 重命名，Ctrl+D 删除。删除前请确认是否还需要保留记录。

输入操作和权限模式见[交互与任务控制](/docs/zh/step-code/guides/interaction)。

## 会话树与派生

| 命令 | 行为 | 适用场景 |
| - | - | - |
| `/tree` | 在同一会话文件中选择历史节点继续 | 回到较早的决策点尝试另一种方案 |
| `/fork` | 从选定的用户消息派生新会话 | 隔离不同对话方案 |
| `/clone` | 将当前分支完整复制到新会话 | 保存当前状态后继续 |

`/tree` 中使用方向键导航、Enter 选择节点、Ctrl+O 切换过滤器（默认、无工具、仅用户消息、仅带标签）、Shift+L 编辑标签。选择用户消息时，其文本可回填到输入框，修改后重发形成新分支。

切换分支时，可以为离开的分支生成摘要，供切换后的对话使用。相关选项在 `[branchSummary]` 中配置。

<Note>
  会话分支只隔离对话记录，不会撤销磁盘文件修改，也不会创建 Git 分支。需要隔离代码实验时，请另行使用 Git 分支或 worktree。摘要和后续模型请求仍可能产生用量。
</Note>

项目任务示例见[常见使用案例](/docs/zh/step-code/guides/use-cases)。

## 管理上下文

从 v0.1.4 起，自动压缩启用且未指定上下文模式时，默认使用 CLM（Context Language Models），由模型选择性精简较早的上下文，不覆盖原始会话日志。精简失败或效果不足时回退到原有摘要压缩；模型用量计入会话统计。

| 命令 | 说明 |
| - | - |
| `/clm [status\|on\|off\|diff\|reset]` | 查看状态、切换当前会话开关、查看修改或清除整理结果 |
| `/clm-compact [要求]` | 主动请求模型整理当前上下文 |
| `/compact [保留要求]` | 使用原有摘要压缩 |

`/clm reset` 不撤销已经发生的原有摘要压缩。整理产生额外模型调用，用量计入会话统计。

## 上下文压缩

摘要压缩保留近期消息，并将较早内容整理为摘要。手动压缩时，可指定需要保留的信息：

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
/compact 保留鉴权改造的目标、接口约定、已改文件、验证结果和未解决的问题
```

自动摘要压缩的开关、预留窗口和近期消息量见[配置文件](/docs/zh/step-code/configuration/files#分节配置)。重要约定和验收结果也应记录在项目文件中。

## 导出与分享

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
/export session.html
/export session.jsonl
```

也可以在命令行导出：

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step --export /path/to/session.jsonl session.html
```

`/export [file]` 默认导出 HTML；使用 `.jsonl` 扩展名导出 JSONL。导出可能包含代码、命令输出与路径，分享前请检查。

## 导入会话

在交互界面中导入已保存的 JSONL 会话：

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
/import session.jsonl
```

将文件名替换为实际会话文件。HTML 导出用于阅读，恢复会话使用 JSONL 文件。

## 会话存储

会话按工作目录分组保存，使用 `/session` 查看当前文件路径。`--session-dir` 指定目录，`--no-session` 关闭本次会话保存。完整目录与清理方法见[数据路径](/docs/zh/step-code/configuration/data-paths#会话数据)。
