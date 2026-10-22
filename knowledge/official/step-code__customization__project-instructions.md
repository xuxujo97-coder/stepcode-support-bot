<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/customization/project-instructions 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/customization/project-instructions

# 项目指引

项目指引记录团队的开发约定、检查命令和操作限制。Step Code 加载指引后，将其作为处理项目任务的上下文。

## 创建项目指引

1. 在项目根目录创建 `AGENTS.md`。已有该文件时，将需要的约定合并进去。
2. 写入适用于当前项目的要求。例如：

```markdown theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
# 项目指引

- 修改代码前，阅读项目的构建配置与测试命令。
- 修改行为时补充对应测试，并报告实际执行的检查结果。
- 不连接生产数据库，不执行生产迁移。
- 不把密钥或私人配置写入提交内容。
```

3. 在 Step Code 中运行 `/reload` 或重新启动，以加载变更。

也可以运行 `/init`，让模型检查项目并生成指引；保存前请核对其中的命令、路径与约束。开始使用后，可要求模型说明本次任务适用的项目约定，检查其引用是否与文件一致。

## 加载范围与选择顺序

| 范围 | 位置 |
| - | - |
| 全局 | `~/.stepcode/agent/AGENTS.md` |
| 项目 | 当前目录及其父目录中的指引文件 |

每个目录按以下顺序选择第一个存在的文件：

1. `AGENTS.override.md`
2. `AGENTS.md`
3. `CLAUDE.md`

Step Code 向上查找到文件系统根。需要为整个团队共享的规则放在项目文件中，个人偏好放在全局文件中。启动参数 `--no-context-files` 可关闭自动发现，参数说明见 [`step` 命令](/docs/zh/step-code/reference/cli)。

## 复用现有指引

现有 `CLAUDE.md` 可以继续使用。复用前，请检查其中的工具名称、命令、路径与模型能力要求是否适用于 Step Code。其他资源的导入方式见[从其他工具迁移](/docs/zh/step-code/guides/migration)。

项目指引用于描述工作要求。需要限制工具操作或项目资源加载时，另行设置[权限与安全](/docs/zh/step-code/guides/permissions)。专项任务可封装为 [Agent Skills](/docs/zh/step-code/customization/skills)；子代理角色文件见 [Agent 与 subagent](/docs/zh/step-code/customization/agents)。
