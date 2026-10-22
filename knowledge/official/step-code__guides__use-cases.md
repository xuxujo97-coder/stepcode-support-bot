<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/guides/use-cases 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/guides/use-cases

# 常见使用案例

## 理解陌生项目

先进行只读勘察，再决定是否实施修改。需要限制工具操作时，先用 `/permissions` 选择 Ask 并核对审批请求。

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
刚接手这个仓库：先看入口和构建脚本，按“启动流程、核心模块、外部依赖”给我一份新人向导，先不要改任何文件。
```

确认结论后，可使用 `/init` 将项目约定整理到 `AGENTS.md`。

复用其他工具的项目指引见[从其他工具迁移](/docs/zh/step-code/guides/migration)。

## 实现新功能

将功能要求和验收条件一起提供；涉及多个模块时先制定计划。

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
给订单列表加一个“按物流状态筛选”的下拉框。要求：复用现有的 FilterBar 组件、URL query 同步、移动端不破版。先列出要动的文件和顺序，我确认后再实现。
```

## 修复 Bug

提供现象、复现条件、预期结果和相关文件。可以附带截图，或用 `!` 将诊断命令的输出加入上下文。

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
购物车金额偶尔少一分钱。金额计算在 src/cart/total.ts。先列出所有取整路径，构造可复现用例，确认根因后提交最小修改并补回归测试。
```

## 写测试与重构

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
为 src/utils/date.ts 的导出函数补充空值、月末和跨时区测试。先保证行为不变，再把重复的格式化逻辑抽为私有 helper，最后运行测试并总结改动。
```

尝试不同方案时可以使用 `/fork` 隔离会话，但代码修改仍在同一工作目录；需要文件隔离时另建 Git worktree。

<a id="长任务放手" />

## 长任务托管

几小时量级的任务可通过 `/goal` 托管，设定目标后持续推进。

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
/goal 把本仓库所有测试迁移到 vitest 并保持全绿。分模块推进，每完成一个模块跑一次全量测试再进入下一个。
```

使用 `/goal status` 查看进展，`/goal pause` 暂停，`/goal resume` 恢复。任务期间保持进程和网络连接可用，详细行为见[目标模式](/docs/zh/step-code/guides/interaction#目标模式)。

定期任务可以让模型创建 cron 调度，并通过 `/cron` 管理，例如定期检查依赖漏洞并汇总结果。定时任务需在 Step Code 进程运行期间调度。

## 并行多代理

批量同构任务（全量审计、多方案对比）可用 workflow 编排多个子代理并行。消息里写 `ultraloop` 或 `ultracode` 明确授权，不会因为任务大就自动开启：

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
ultraloop 把 docs/ 下所有英文页翻成中文：每页一个子代理翻译，另一个子代理校对术语一致性，最后合并输出改动清单。
```

需要并行修改时，为各子任务划分不同文件，或明确要求独立 worktree。多代理会独立消耗 token。详见 [Agent 与 subagent](/docs/zh/step-code/customization/agents)。

## 发布静态网站

先用 `/mcp` 检查 StepPage 状态。已有 Step 登录或 `STEPFUN_API_KEY` 均可提供凭据；插件缺失或此前主动卸载时，使用 `/plugin install steppage` 安装并重启。准备好构建产物后，明确指定目录和是否上线：

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
检查 ./dist 中是否有密钥或私有配置。向我确认发布范围后，再生成预览链接，暂不上线已有站点。
```

安装、部署、版本管理与发布前检查见[发布 StepPage](/docs/zh/step-code/reference/steppage)。

## 生成与维护文档

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
对比 src/ 实现与 docs/ 说明，更新过时段落。新增模块补充用途、入口和示例，不确定的信息列出来，不要编造。最后检查内部链接和代码示例。
```

重要讨论可以通过 `/export` 导出。
