<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/reference/tools 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/reference/tools

# 内置工具

默认 Step 工具使用 `read_file`、`run_command` 等名称。原生工具集使用 `read`、`bash` 等名称；参数应按实际注册的工具查询。

## 工具总表

| Step 工具 | 对应原生工具 | 用途 |
| - | - | - |
| `read_file` | `read` | 读取文本和图片 |
| `write_file` | `write` | 创建或覆盖文件 |
| `edit_file` | `edit` | 精确替换文本 |
| `run_command` | `bash / powershell` | 执行命令 |
| `search_files` | `grep` | 搜索文件内容 |
| `find_files` | `find` | 按名称或 glob 查找文件 |
| `list_directory` | `ls` | 列出目录 |

<a id="read" />

## read\_file

支持文本文件和 JPG、PNG、GIF、WebP、BMP 图片。使用 `path` 指定文件；文本可通过 `start_line`、`end_line` 指定行范围，`max_chars` 控制返回字符数。图片作为附件返回，能否用于推理取决于模型能力。

<a id="bash（windows-为-powershell）" />

## run\_command

使用 `command` 指定命令，`cwd` 指定目录，`max_output_chars` 限制返回文本。前台默认超时为 120 秒（v0.1.3 起），可用 `timeout_ms` 调整，取值范围 1000 至 600000 毫秒。

Windows 的 Bash 命令优先使用原生 Git Bash，不自动改用 WSL；PowerShell 是另一执行路径。需要 WSL 时可在 WSL 内启动 Step，或配置对应的 `shellPath`。

`run_in_background` 启动分离进程并返回 PID 与日志文件。通过日志检查状态，使用返回的停止命令清理进程；会话结束时仍运行的进程会被清理。后台模式下 `timeout_ms` 和 `max_output_chars` 均不适用。输入框中的 `!` 和 `!!` 行为见[交互与任务控制](/docs/zh/step-code/guides/interaction)。

<a id="edit" />

## edit\_file

对单个文件进行精确文本替换。模型侧 `edit_file` 使用 `path`、`search`、`replace`、`replace_all` 和 `then_run`；`search` 是待替换的字面量文本（不是正则），`replace` 是新文本。`search` 默认必须唯一匹配，重复出现时报错；设置 `replace_all=true` 时替换全部匹配。匹配失败时先重新读取文件，避免根据过期内容修改。

<a id="write" />

## write\_file

使用 `path` 和 `content` 创建或完整覆盖文件。保留原内容的局部修改使用 `edit_file`。

v0.1.3 起，`edit_file` 和 `write_file` 支持可选参数 `then_run`：修改或写入成功后运行验证命令并返回结果。命令遵守正常审批；验证失败不会撤销已写文件。

<a id="grep" />

## search\_files

模型侧 `search_files` 使用 `pattern`、`path`、`glob`、`context_lines` 和 `max_results`，其中 `pattern` 为正则表达式。后端顺序为 ripgrep（自动下载或系统）> `git grep`（在 Git 仓库内时）> POSIX `grep`，全部不可用时报错。搜索工具缓存见[数据路径](/docs/zh/step-code/configuration/data-paths#内置工具缓存)。

<a id="find" />

## find\_files

使用 `path`、`pattern` 和 `max_results` 按文件名或 glob 查找。返回路径后，使用读取工具检查文件。

<a id="ls" />

## list\_directory

使用 `path` 指定目录，`include_hidden` 控制隐藏项，`max_entries` 限制条目数。

## 工具开关

`defaultTools` 控制原生内置工具，例如：

```toml theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
defaultTools = ["read", "grep", "find", "ls"]
```

Step 工具和扩展工具需要另行选择，不能把上述原生工具配置当作整个会话的只读限制。原生 `read` 使用 `offset` / `limit`，原生 `edit` 使用 `oldText` 等字段；不要将这些参数传给同用途的 Step 工具。

| 启动参数 | 用途 |
| - | - |
| `--tools` | 按注册名称选择工具 |
| `--exclude-tools` | 排除指定工具 |
| `--no-builtin-tools` | 禁用原生内置工具 |
| `--no-tools` | 禁用全部工具 |

工具审批与访问边界见[权限与安全](/docs/zh/step-code/guides/permissions)，完整启动参数见 [`step` 命令](/docs/zh/step-code/reference/cli)。
