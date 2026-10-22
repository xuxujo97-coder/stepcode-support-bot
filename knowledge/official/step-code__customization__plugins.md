<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/customization/plugins 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/customization/plugins

# 插件与 Packages

Step Code 通过插件市场和 Packages 分发扩展、Skills、主题、Agent 和 MCP 服务器。

## 两种分发形态

| 形态 | 管理入口 | 内容 |
| - | - | - |
| Packages 资源包 | `step install` 等命令 | TypeScript 扩展、Skills、prompt 模板、主题 |
| 插件市场 | `/plugin` | 声明式 manifest、Skills、Agent、命令、MCP |

## 安装插件

1. 运行 `/plugin` 查看已配置市场中的插件。
2. 使用 `/plugin install <插件名称>` 安装需要的插件。
3. 安装含 MCP 的插件后重启 Step Code，通过 `/mcp` 检查服务，并验证实际需要的功能。

<a id="packages：安装与管理" />

## 安装与管理 Packages

资源包使用独立的命令管理。命令格式如下，来源可以是本地目录、npm 包或 Git 仓库：

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step install <资源包来源>
step list
step remove <资源包来源>
```

* 默认安装到用户范围并写入全局配置。
* `-l` 写入项目 `.stepcode/config.toml`；团队成员信任项目后，启动时自动补装。
* `step -e <来源>` 可临时加载扩展，不将它写入持久配置，但仍会执行扩展代码。

## 包过滤与启停

在 `config.toml` 中指定加载范围：

```toml theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
[[packages]]
source = "npm:@example/package"
extensions = ["extensions/*.ts", "!extensions/legacy.ts"]
```

按需使用 glob、`!` 排除，以及 `+path` / `-path` 精确增删资源。也可以运行 `step config`，使用 Tab 切换全局与项目范围并管理启停。

同名包的项目级配置覆盖全局条目，项目资源仍受信任设置控制。

<a id="steppage：发布静态网站" />

## StepPage

`steppage` 用于发布静态目录或 ZIP 并管理站点版本。先通过 `/mcp` 检查 StepPage 是否已就绪；插件缺失或此前主动卸载时，使用 `/plugin install steppage` 安装并重启。StepPage 自动准备需要外部 Node.js 20 或更新版本；这不是 Step Code 独立程序本身的依赖。准备失败可运行 `step mcp prepare` 后重启检查。安装、部署与回滚流程见[发布 StepPage](/docs/zh/step-code/reference/steppage)。内置市场还提供 `playwright` 浏览器操控插件。

## 创建本地资源包

创建 `my-step-package` 目录，保存以下两个文件。

`my-step-package/package.json`：

```json theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
{
  "name": "my-step-package",
  "version": "1.0.0",
  "private": true,
  "pi": { "skills": ["./skills"] }
}
```

`my-step-package/skills/project-summary/SKILL.md`:

```markdown theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
---
name: project-summary
description: 根据用户提供的 README 总结项目用途。用户需要项目摘要时使用。
---

阅读用户提供的 README，概括项目用途和已记录的启动方式。未提供的信息标记为“未说明”。不修改文件。
```

从 `my-step-package` 的父目录安装：

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step install ./my-step-package
step list
```

在包含 `README.md` 的项目中运行 `step @README.md`，然后在交互输入框中执行 `/skill:project-summary`，检查摘要是否符合文件内容。本地包按路径加载，请保留源目录。

## 包来源与 manifest

| 来源 | 行为 |
| - | - |
| `npm:` | 通过包管理器安装；指定版本的条目保持锁定 |
| `git:` 或仓库 URL | 克隆仓库；配置的 tag 或 commit 不自动移动到新引用 |
| 本地文件 | 作为单个扩展加载 |
| 本地目录 | 按资源包规则发现内容 |

资源包在 `package.json` 的 `pi` 字段中声明 `extensions`、`skills`、`prompts`、`themes` 四类资源路径，支持 glob 和 `!` 排除；无 manifest 时按同名约定目录加载。资源路径相对包根目录解析。

用户级包通常保存在 `~/.stepcode/agent/npm/` 和 `git/`；项目级包保存在 `.stepcode/npm/` 或 `.stepcode/git/`。不要在托管克隆中保留唯一的未提交修改，更新可能重新对齐锁定引用。

Skill 格式见[Agent Skills](/docs/zh/step-code/customization/skills)。

## 插件清单格式

原生 manifest 使用 `step.plugin.json`，兼容 `.claude-plugin/plugin.json` 和市场清单 `marketplace.json`。字段包括 `id`、`name`、`description`、`version`、`entry`、`skills`、`agents`、`commands`、`mcpServers` 和 `provision`。`id` 为必填字段；插件清单文件的大小上限为 512 KiB；`entry` 是可执行入口字段，仅记录，不加载。

## 依赖与打包

第三方运行时依赖放在 `dependencies`，安装时使用 `npm install --omit=dev`。由运行时提供的核心包放在 `peerDependencies: "*"`，不重复打包。

依赖其他 Step 包时，在 `dependencies` 和 `bundledDependencies` 中声明，并通过 `node_modules/` 路径引用资源。

## 插件市场

| 命令 | 作用 |
| - | - |
| `/plugin` | 打开管理菜单 |
| `/plugin install <插件>` | 安装插件 |
| `/plugin remove <插件>` | 卸载插件 |
| `/plugin marketplace list` | 列出市场源 |
| `/plugin marketplace add` | 添加市场源 |
| `/plugin marketplace update` | 更新市场索引 |
| `/plugin marketplace remove` | 移除市场源 |

安装或卸载包含 MCP 的插件后，重启 Step Code 才会启动或停用对应服务器。使用 `/mcp` 检查加载结果。

MCP 服务器配置字段见[MCP](/docs/zh/step-code/customization/mcp)。

自定义 Agent 的格式见[Agent 与 subagent](/docs/zh/step-code/customization/agents)。

<a id="安全注意" />

## 安全注意事项

扩展、包和 stdio MCP 可以按当前系统用户权限执行代码；Skills 和 Agent 指令也可能引导执行命令。安装包或 Git 依赖可能执行包管理器操作，请审查来源、版本和安装脚本，只安装可信来源，并为项目提供最小必要凭据。

Step Code 没有文件式 Hooks；等价的自动化拦截使用扩展事件 `tool_call`、`tool_result`、`input` 等实现。
通用工具审批和数据访问规则见[权限与安全](/docs/zh/step-code/guides/permissions)。
