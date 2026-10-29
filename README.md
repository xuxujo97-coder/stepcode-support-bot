# Step Code 飞书支持 Bot

飞书群里的 Step Code 助手：回答 Step Code 使用问题（基于官方文档快照的 RAG 问答），并收集问题反馈、自动同步到飞书多维表格。

## 功能

- **群问答**：白名单群里 @机器人 提问，回复落在话题里；30 分钟追问上下文（群话题内共享），回答只基于 `knowledge/official/` 文档快照并附引用。
- **反馈命令**：
  - `/bug <描述>`、`/feature <描述>`：登记问题/功能建议（写主反馈表）。
  - `/desktop <描述>`：桌面端（客户端应用）问题反馈，自动写入桌面端反馈表：
    - 消息里自带的截图/文件会下载并挂到记录的附件列；
    - 反馈人员=发送者，处理状态初始为「未处理」；
    - **指派标注**：描述里任意位置带 `@某人` + 动词（需真实 @ 提及）时，被 @ 者自动写入「Dev 负责人」。动词：跟进/处理/修复/排查/排期（及跟进中/处理中/修复中/开发中/排查中）→ 状态「处理中」；已处理/已修复/已完成/已解决 → 「已完成」。动词后紧跟其他文字（如“处理中断”“处理中文”）不触发；紧凑标注（@名字（别名）紧接动词）才从描述剥掉。
    - **疑似重复提示**：新记录创建后自动与表中未完成记录做一次模型比对，疑似同题时在新记录备注写入“疑似与 recX 重复”，并在回执中附主记录链接提示 PM；只提示不自动归并，PM 确认后在表格把重复记录的「父记录」指向主记录、状态置「重复」。
  - `/wish <愿望描述>`：许一个 Step Code 相关的愿望，自动写入许愿表（许愿人=发送者、愿望描述原文、消息附件自动存档），PM评估列留给人工。
  - `/diagnose <Feedback ID>`：根据客户端反馈 ID 拉会话包给初步诊断。
  - `/help`、`/new`、`/status`。
- **安全边界**：疑似含凭据的消息不进模型不进表；模型日预算（默认 100 次/天）；所有外部写入走幂等台账，失败挂起待人工 reconcile，从不自动重试。

## 结构

```
src/
  main.ts             # 入口：run / check / pending / reconcile / ack-reply
  transport.ts        # lark-cli 事件长连接消费、消息解码（@提及、话题、非 bot 提及捕获）、投递
  host.ts             # 准入/重定向/命令分发/会话键
  commands.ts         # 命令解析与固定文案
  model.ts            # step-5-preview 单模型调用（分类/审阅/答题）+ 日预算
  knowledge.ts        # 官方文档快照检索与答案校验
  feedback.ts         # 主反馈表写入适配器
  desktop-feedback.ts # 桌面端反馈表写入 + @指派解析 + 疑似重复标记
  wish.ts             # 许愿表写入（许愿人/描述/附件）
  attachments.ts      # 消息资源下载挂附件的公共逻辑
  lark-client.ts      # lark-cli 封装（bot 身份 + 运维用户身份两条执行路径）
  state-store.ts      # node:sqlite：会话/投递/预算/归属
  config.ts           # 配置加载与敏感信息检测
  diagnostics.ts      # 反馈会话包诊断
test/                 # node:test 单测（98 个）
knowledge/            # 官方文档快照（RAG 语料）
```

## 运行

服务以 systemd user service 常驻（见 `stepcode-support-bot.service`）：

```
pnpm exec tsx --tsconfig tsconfig.json apps/support-bot/src/main.ts run <config.json>
```

配置与密钥在仓库外（`~/.config/stepcode-support-bot/`）：`config.json`（群白名单 allowedChats、私聊白名单 allowedUsers、模型 key 文件路径、日预算）、`model-key`（0600）。模板见 `support-config.example.json`。

依赖 `@step-harness/coding-agent` / `@step-harness/providers`（model.ts 的模型运行时），源自 step-harness monorepo（`apps/support-bot/`），本仓库是抽取快照，独立目录下不能直接 `pnpm install` 构建。

消息与表格通过 [lark-cli](https://github.com/larksuite/cli) 完成：机器人身份用专用 profile（事件订阅/回复/表情），多维表格写入用运维者个人 user 身份（`--as user`，机器人应用对目标表无写权限）。

## 部署

Mac 上改代码后同步并重启：

```
rsync -az --exclude node_modules -e "ssh -o ClearAllForwardings=yes" apps/support-bot/ devmachine:services/stepcode-support-bot/apps/support-bot/
ssh devmachine 'systemctl --user restart stepcode-support-bot'
```

改 `config.json`（如群白名单）同样需要重启才生效。

## 测试

```
pnpm exec tsx --tsconfig tsconfig.json --test apps/support-bot/test/*.test.ts
```
