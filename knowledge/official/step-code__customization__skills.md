<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/customization/skills 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/customization/skills

# Agent Skills

将专项工作流、脚本和参考资料组织为 Skill，供模型按需读取或通过斜杠命令调用。

<a id="skills-是什么" />

## Skill 结构

Skill 是以 `SKILL.md` 为入口的能力包，遵循 [Agent Skills](https://agentskills.io/) 格式。启动时主要加载名称和描述，模型判断相关后再读取完整指令，减少不必要的上下文占用。

<a id="完整示例" />

## 创建 Skill

保存为 `~/.stepcode/agent/skills/api-review/SKILL.md`：

```markdown theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
---
name: api-review
description: 审查 REST API 变更的兼容性与文档完整性。当任务涉及路由、请求响应类型或 OpenAPI 变更时使用。
---

# API 变更审查

1. 使用 git diff 找出本次变更涉及的路由与类型。
2. 检查破坏性变更、错误码、鉴权要求和示例是否同步。
3. 参照 references/checklist.md 输出审查结论。
```

在同目录的 `references/checklist.md` 中编写项目审查清单，然后运行 `/reload`，使用 `/skill:api-review`。包含辅助脚本的 Skill 可能执行本地命令，只加载可信来源。

`references/checklist.md` 可使用以下内容：

```markdown theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
# 接口检查清单

- 请求和响应字段是否与文档一致？
- 是否改变鉴权、错误码或已有客户端的行为？
- 是否补充对应测试与调用示例？
```

## 调用

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
/skill:api-review 检查本次接口改动
```

`enableSkillCommands` 默认启用，将 Skill 注册为 `/skill:<名称>`。参数以 `User: <参数>` 追加到 Skill 内容后。

模型根据 `description` 判断何时读取 Skill，不一定会自动读取。需要明确执行某项工作流时，请使用斜杠命令；设置 `disable-model-invocation: true` 可关闭自动发现入口。

<a id="复用其他-harness-的-skills" />

## 复用其他工具的 Skills

```toml theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
skills = ["~/.codex/skills"]
```

`~/.codex/skills` 等非默认目录需要加入 `skills` 数组；Claude 和 Step 目录会自动发现，不必重复加入。加入后无需复制文件。使用前检查其中引用的命令、路径、模型能力和工具名称，避免沿用其他工具专属的行为假设。

子代理的定义和调用见[Agent 与 subagent](/docs/zh/step-code/customization/agents)。

## 存放位置

优先级从高到低如下：

| 范围 | 位置 |
| - | - |
| 项目 | `.stepcode/skills/`、项目范围内的 `.agents/skills/` 和 `.claude/skills/`，需要项目信任 |
| 用户 | `~/.stepcode/agent/skills/`、`~/.stepcode/skills/`、`~/.agents/skills/`、`~/.claude/skills/` |
| 包 | 资源包声明的 Skills 目录 |
| 启动参数 | `--skill <路径>`，可重复，设置 `--no-skills` 后仍加载 |

项目 `.agents/skills/` 和 `.claude/skills/` 的发现会向上查找到 Git 根。上述目录自动发现，不必重复加入 `skills` 数组；`~/.codex/skills` 等非默认目录仍需使用 `config.toml` 的 `skills` 数组显式指定。

资源包的安装与分发见[插件与 Packages](/docs/zh/step-code/customization/plugins)。

## 文件格式

### 目录结构

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
api-review/
├── SKILL.md
├── scripts/
│   └── check.sh
└── references/
    └── checklist.md
```

在 `SKILL.md` 中使用相对路径引用包内资料。`scripts/` 和 `references/` 是可选目录。

### Frontmatter 字段

| 字段 | 要求 | 说明 |
| - | - | - |
| `name` | 必填 | 最多 64 字符，使用小写字母、数字和连字符，跨工具复用时建议与父目录名一致 |
| `description` | 必填 | 最多 1,024 字符，说明用途和触发场景 |
| `license` | 可选 | 许可证 |
| `compatibility` | 可选 | 环境和依赖要求 |
| `metadata` | 可选 | 其他元数据 |
| `allowed-tools` | 可选 | 空格分隔的工具列表，实验性能力 |
| `disable-model-invocation` | 可选 | `true` 时不自动展示给模型，只保留手动调用入口 |

### 校验规则

大写、首尾连字符、连续连字符和超长名称会告警但仍加载；缺少 `description` 不加载；重名保留第一个并告警。未知 frontmatter 字段忽略。

为跨工具复用，建议按标准修正全部命名和长度问题。Skill 的工具声明不能替代 Step Code 的权限控制。
