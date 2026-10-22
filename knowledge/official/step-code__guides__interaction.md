<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/guides/interaction 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/guides/interaction

# 交互与任务控制

在交互输入框中引用文件、发送消息或执行命令。Plan、目标和定时任务用于不同的任务控制场景。

<a id="审批流程" />

<a id="权限模式" />

<a id="输入框基本操作" />

<a id="斜杠命令" />

开始任务前，通过 `/permissions` 检查当前模式，详见[权限与安全](/docs/zh/step-code/guides/permissions)。Enter 发送消息，Shift+Enter 换行，Esc 中断输出；输入 `/` 选择命令。完整操作见[键盘快捷键](/docs/zh/step-code/reference/keyboard-shortcuts)和[斜杠命令](/docs/zh/step-code/reference/slash-commands)。

## 文件引用

输入 `@` 搜索项目文件，使用 Tab 补全路径。Git 和非 Git 目录均可使用，也可以从命令行传入文件：

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step @README.md "总结这个项目的用途和运行方式"
step @src/app.ts @src/app.test.ts "审查这两个文件的实现与测试是否一致"
```

被引用或被工具读取的文件内容可能进入模型上下文。引用前请检查密钥、个人信息和业务敏感数据。

## 粘贴图片

使用 Ctrl+V 粘贴剪贴板图片；Windows / WSL 使用 Alt+V。支持的终端也可以拖入图片路径。

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step -p @screenshot.png "这张截图里的报错怎么修？"
```

请先选择支持图片输入的模型。默认图片缩放会将过大的图片限制在 2,000 px 以内，以减少输入体积；可通过 `[images]` 配置调整。终端内联显示与向模型发送图片分别控制，关闭内联显示后仍可发送图片。

## Shell 命令直通

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
!npm run lint
!!git status --short
```

`!` 执行本地 Shell 命令并将输出加入模型上下文；`!!` 执行但不将输出发给模型。这两个前缀对单条命令生效，无需切换模式；通过输入框执行的命令不支持后台运行。输出以卡片形式显示，长输出自动收起，可使用 Ctrl+O 展开。

## 流式输出期间

* Enter 将新消息排队，当前助手轮次的工具调用结束后投递。
* Esc 中止当前轮次，并将队列消息恢复到输入框。
* Alt+↑ 取回排队消息；Windows / WSL 使用 Alt+Q。
* Ctrl+O 折叠或展开工具输出。

`steeringMode` 和 `followUpMode` 控制消息投递方式，可在设置中调整。follow-up 默认没有单独快捷键。

## 外部编辑器

Ctrl+G 打开外部编辑器编辑当前输入，动作名为 `app.editor.external`。选择顺序为 `externalEditor` 设置、`VISUAL`、`EDITOR`，最后使用 Windows 记事本或其他系统的 nano。

<a id="模式切换" />

## Plan 模式

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
/plan 梳理鉴权模块的依赖，先给出迁移计划，不修改业务代码
```

`/plan` 切换模式，`/plan <任务>` 直接开始规划；启动时也可以使用 `step --plan`。模型先勘察项目并写入计划文件。

Plan 模式下，文件编辑仅允许修改计划文件；Shell 命令仍按正常权限执行。批准计划后退出 Plan 模式并开始实施。

## 目标模式

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
/goal 将测试迁移到 Vitest，保持现有用例通过，并提供改动摘要
```

目标模式持续驱动多轮执行，直到目标达成或手动停止，适合几小时量级的长任务。任务期间请保持 Step Code 进程运行。

| 命令 | 作用 |
| - | - |
| `/goal status` | 查看目标、状态和用量 |
| `/goal pause` | 暂停自动续跑，中断进行中的目标续跑轮次 |
| `/goal resume` | 恢复目标 |
| `/goal edit` | 修改目标描述 |
| `/goal clear` | 清除目标 |

状态行显示活跃计时，例如 `Goal: active · 12m 3s`，仅累计目标活跃时间。

## 管理定时任务

定时任务使用五字段 cron 表达式；持久任务保存在项目 `.stepcode/cron/tasks.json`，需要项目信任。持久任务仍需在 Step Code 进程运行期间调度。

多代理编排与授权见[Agent 与 subagent](/docs/zh/step-code/customization/agents)。

创建任务后，通过 `/cron` 核对时间与任务内容，并删除不再需要的任务。
