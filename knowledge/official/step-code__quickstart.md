<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/quickstart 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/quickstart

# 快速开始

<a id="step-code-是什么" />

<a id="产品简介" />

Step Code 可在项目目录中读取文件并处理开发任务。产品能力与适用场景见 [Step Code 概览](/docs/zh/step-code/overview)。

## 准备条件

* 可用的 Step Plan 账号或阶跃 API Key，以及访问模型服务的网络连接。
* 一个可供分析、包含 `README.md` 的项目目录；请确认该文件可发送给所选模型服务。

## 安装

<Note>
  安装命令会执行远程脚本。请先确认来源可信；指定安装版本或卸载时，见[升级](/docs/zh/step-code/installation)。
</Note>

<Tabs>
  <Tab title="macOS / Linux">
    ```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
    curl -fsSL https://static-openapi.stepfun.com/stepcode/install.sh | bash
    ```
  </Tab>

  <Tab title="Windows PowerShell">
    ```powershell theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
    irm https://static-openapi.stepfun.com/stepcode/install.ps1 | iex
    ```

    PowerShell 支持处于 beta 阶段，也可以在 WSL 中使用 Linux 安装命令。
  </Tab>
</Tabs>

安装完成后重新打开终端，运行 `step --version`，确认输出版本号。

StepPage 自动准备需要外部 Node.js 20 或更新版本；这不是 Step Code 独立程序本身的依赖。准备失败可运行 `step mcp prepare` 后重启检查。原生 Windows 暂不自动安装，可使用 WSL 或自行准备。该命令是内置资源准备入口，不是所有第三方 MCP 的通用修复命令。

## 首次启动

进入准备好的项目目录，将示例路径替换为实际路径：

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
cd /path/to/project
step
```

按首次启动提示登录并选择主题。检测到其他工具的 MCP 配置时会提示导入；已有配置的复用方式见[从其他工具迁移](/docs/zh/step-code/guides/migration)。

## 登录

1. 在交互输入框中运行 `/login`。
2. 按账号所在地区和计费方式选择阶跃登录入口。国内 Step Plan 订阅选择 Step Plan，海外订阅选择 Step Plan Oversea，并在浏览器完成授权；使用 API Key 时，选择与该 Key 对应的阶跃账号入口。
3. 运行 `/model`，选择账号可用的模型。

在 SSH、服务器或容器终端中，可运行 `step login --no-browser` 获取授权链接，在本机或其他设备的浏览器中完成登录。该命令仍要求交互终端，不依赖本地回调端口。

订阅与按量付费使用不同通道。完整登录说明、端点和其他供应商的接入方式见[登录与模型](/docs/zh/step-code/configuration/models)。

## 确认权限

未配置权限的新交互会话默认使用 Approve for Me：常规操作自动执行，检测到危险或无法完整分析的命令时仍需确认。需要在修改文件和运行命令前逐项确认时，运行 `/permissions` 并选择 Ask。权限模式不是系统沙箱，只在可信目录中运行。各模式行为与项目访问边界见[权限与安全](/docs/zh/step-code/guides/permissions)。

## 第一个对话

在交互输入框中引用 `README.md` 并发送任务：

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
@README.md 根据这个文件，概括项目用途、启动方式和测试命令。未写明的信息请标注“未说明”。不修改文件，不运行命令。
```

## 检查结果

确认回答以 README 的实际内容为依据，未补写文件中不存在的启动方式或测试命令，并检查工具记录中是否有超出任务范围的操作。在 Git 项目中，可通过 `git diff` 检查文件改动。

使用 `/quit` 退出。需要继续同一任务时，按[会话与上下文](/docs/zh/step-code/guides/sessions)恢复会话。

<a id="给项目加指引" />

<a id="配置项目指引" />

<a id="常用命令与快捷键" />

<a id="数据存放在哪里" />

<a id="数据存放位置" />

<a id="升级与卸载" />

## 下一步

* [项目指引](/docs/zh/step-code/customization/project-instructions)：配置团队约定与检查要求。
* [交互与任务控制](/docs/zh/step-code/guides/interaction)：引用图片、规划任务、管理目标与定时任务。
* [斜杠命令](/docs/zh/step-code/reference/slash-commands)和[键盘快捷键](/docs/zh/step-code/reference/keyboard-shortcuts)：查询完整操作列表。
* [数据路径](/docs/zh/step-code/configuration/data-paths)：查找配置、凭据和会话，备份或清理本地数据。
* [升级](/docs/zh/step-code/installation)：更新程序、指定版本或卸载；版本变化见[版本记录](/docs/zh/step-code/release-notes)。
