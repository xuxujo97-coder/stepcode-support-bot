# Step Code 远程连接 IM / 飞书 / Lark 会话

核实日期：2026-10-19。以下是公开文档证据及其适用范围，不能把未列出功能解释为所有版本都不支持。

已核实：官方版本记录页面当前列出的最新版本是 v0.1.5（2026-10-16），页面的新功能、优化和修复未列出 IM 会话连接。公开斜杠命令参考也未列出 /connect 或 /connect lark。结论限于“当前公开文档没有已确认可用的内置 IM 连接入口”，不等同于检查过最新二进制或所有插件。

来源：https://platform.stepfun.com/docs/zh/step-code/release-notes
来源：https://platform.stepfun.com/docs/zh/step-code/reference/slash-commands

区别：IM 远程会话连接是从飞书、钉钉等聊天发送任务并查看编程会话进度。通过 SSH 远程登录账号只是账号授权；使用 lark-cli 等 IM 工具执行授权操作，以及当前“Step Code助手”回答问题、登记反馈，都不等于远程控制用户的 Step Code 会话。
