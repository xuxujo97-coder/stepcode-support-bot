<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/reference/faq 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/reference/faq

# 常见问题

## 安装与升级

### 安装后找不到 step？

重新打开终端，使 PATH 配置生效。默认安装目录为 `~/.stepcode/bin`；Windows 为 `%USERPROFILE%\.stepcode\bin`。检查可执行文件是否存在，以及是否配置了自定义安装路径。

安装脚本写入的 PATH 块带标记，可检查对应 Shell 登录配置。

### 如何升级？

运行 `step update`。选择版本和卸载步骤见[升级](/docs/zh/step-code/installation)。

## 登录与模型

### /login 中应该选择哪个平台？

国内阶跃订阅选择 Step Plan，海外订阅选择 Step Plan Oversea。按量付费使用对应地区的开放平台 API Key。其他供应商按[登录与模型](/docs/zh/step-code/configuration/models)使用环境变量或自定义平台配置。

### 远程终端如何登录？

在 SSH、服务器或容器终端中，可运行 `step login --no-browser` 获取授权链接，在本机或其他设备的浏览器中完成登录。该命令仍要求交互终端，不依赖本地回调端口。

### 更新环境变量后仍在使用旧密钥？

保存的账号或自定义模型配置可能影响所用凭据。请同时检查 `auth.json`、`models.json`、启动参数和进程环境，并从设置了变量的终端重启。完整说明见[登录与模型](/docs/zh/step-code/configuration/models)。

### 自定义模型没有出现在 /model？

检查 `models.json` 的 JSON 格式、模型 ID 和平台配置。本地无鉴权服务也需要非空 `apiKey` 占位值。保存后重新打开 `/model`；涉及登录和环境变量时还需重启。

### 切换模型后用量增加？

切换模型可能无法复用之前的提示词缓存，价格和分词方式也可能不同。查看当前模型、会话用量和账户账单，不要仅根据对话长度判断成本。

## 交互

### Shift+Enter 发送了消息，而没有换行？

改用 Ctrl+J 或 Alt+Enter。部分终端会拦截组合键，需要调整终端按键转发或 Step Code 的键位配置。

### 为什么工具不弹审批？

未配置权限的新交互会话默认使用 Approve for Me，普通调用不逐项审批。需要修改文件和运行命令前确认，可选择 Ask。危险命令规则命中的操作会另行处理，但规则不是覆盖所有风险的安全沙箱。各模式行为见[权限与安全](/docs/zh/step-code/guides/permissions#权限模式)。

### 升级后为什么重新出现审批？

已保存的旧权限模式会重置为 Ask。运行 `/permissions` 选择需要的模式。

### 粘贴图片失败？

使用 Ctrl+V，Windows / WSL 使用 Alt+V。确认剪贴板中确实是图片、终端快捷键没有冲突，并选择支持图片的模型。可改用 `step @screenshot.png` 引用文件。

## MCP 与插件

### MCP 显示 failed？

运行 `step mcp get <名称>` 检查声明。stdio 服务重点检查命令路径、参数、依赖和环境变量；HTTP 服务检查地址、鉴权变量和授权状态。不要在反馈中粘贴真实 token。

### 安装插件后 MCP 没有生效？

安装或卸载插件后需重启 Step Code，再通过 `/mcp` 检查。确认程序已安装，项目已信任，服务器没有被设置为 `enabled = false`。

### StepPage 未就绪怎么办？

StepPage 自动准备需要外部 Node.js 20 或更新版本；这不是 Step Code 独立程序本身的依赖。准备失败可运行 `step mcp prepare` 后重启检查。原生 Windows 暂不自动安装，可使用 WSL 或自行准备。该命令是内置资源准备入口，不是所有第三方 MCP 的通用修复命令。

## 数据与隐私

### 数据保存在哪里？

默认全局数据在 `~/.stepcode/`，项目资源在项目 `.stepcode/`。自定义路径和清理方式见[数据路径](/docs/zh/step-code/configuration/data-paths)。

### 本地 Agent 是否意味着代码不会发送出去？

不是。模型调用会发送任务相关内容，工具和插件也可能访问外部服务。只读工具不修改文件，但读取内容仍可能进入模型上下文。处理敏感项目时应先确认供应商、数据处理要求和可访问范围。

### 如何关闭遥测？

在全局 `config.toml` 设置：

```toml theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
[telemetry]
enabled = false
```

遥测与模型请求、MCP 和主动反馈分别管理。具体配置见[配置文件](/docs/zh/step-code/configuration/files#遥测)。

## 反馈

使用 `/feedback` 提交问题。建议附上 `step --version` 的结果、操作系统、终端类型、复现步骤，以及脱敏后的错误信息。分享会话导出或日志前检查代码、路径和凭据。
