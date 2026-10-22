<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/reference/steppage 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/reference/steppage

# 发布 StepPage

通过 `steppage` 插件，将本地静态产物发布到 StepFun Page，获取预览链接并管理版本。

<a id="是什么" />

`steppage` 通过 MCP 服务器 `steppage-mcp` 提供部署、站点查询、版本管理、上线和回滚等工具。它接收本地目录或 ZIP，用于静态网页托管，不提供应用后端或数据库运行环境。

<a id="安装前置" />

## 安装条件

| 项目 | 要求 |
| - | - |
| 凭据 | `STEPFUN_API_KEY` 环境变量；已登录 Step 账号时可使用已保存的登录凭据 |
| MCP 程序 | `steppage-mcp`；缺少时经官方安装器自动补齐 |
| 生效方式 | 安装后重启 Step Code，并通过 `/mcp` 检查状态 |
| Windows | 暂不自动安装 MCP 程序，可使用 WSL 或手动配置 |

StepPage 自动准备需要外部 Node.js 20 或更新版本；这不是 Step Code 独立程序本身的依赖。准备失败可运行 `step mcp prepare` 后重启检查。原生 Windows 暂不自动安装，可使用 WSL 或自行准备。该命令是内置资源准备入口，不是所有第三方 MCP 的通用修复命令。

## 安装插件

从 v0.1.1 起，首次启动会自动预装 StepPage；主动卸载后不会重复安装。先通过 `/mcp` 检查 StepPage 状态，仅在插件缺失或此前主动卸载时，在 Step Code 中运行：

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
/plugin install steppage
```

官方安装器地址为 `https://dl.stepfun.com/steppage-mcp/p/install.sh`，可通过 `STEPCODE_STEPPAGE_INSTALLER_URL` 覆盖。需要手动执行时：

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
curl -fsSL https://dl.stepfun.com/steppage-mcp/p/install.sh | sh
```

Bash / Zsh 环境变量方式示例：

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
export STEPFUN_API_KEY="YOUR_STEP_API_KEY"
step
```

将占位符替换为您的密钥，修改环境变量后重新启动 Step Code。独立 CLI 与 MCP 的使用方式见[静态托管 CLI 与 MCP](/docs/zh/guides/developer/page-hosting-cli-mcp)。

插件的安装与管理见[插件与 Packages](/docs/zh/step-code/customization/plugins)。

MCP 连接与鉴权见[MCP](/docs/zh/step-code/customization/mcp)。

## 部署

<Warning>
  部署会将产物上传到外部托管服务。公开链接可能被他人访问和转发，发布前应检查内容与访问权限。
</Warning>

1. 将前端项目构建为静态产物，如 `dist/`。
2. 检查入口页面、资源路径和产物目录，排除密钥、私有配置和用户数据。
3. 向 Step Code 明确指定要发布的目录及是否上线。
4. 检查工具返回的预览链接、版本和管理入口，并在浏览器中检查页面和静态资源。

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
把 ./dist 发布成网页，生成预览链接。
```

模型通过 `page_deploy` 将指定目录或 ZIP 发布为站点版本，返回结果自动附管理入口链接。更新已有站点时，请提供明确的站点标识。

其他项目任务示例见[常见使用案例](/docs/zh/step-code/guides/use-cases)。

<a id="版本管理与回滚" />

## 上线版本

1. 列出站点与版本，核对目标站点标识和待上线的版本。
2. 向 Step Code 明确指定站点与版本，请求上线；`promote` 将该版本设为线上版本。
3. 访问线上地址，核对页面和资源。

## 回滚版本

1. 查看当前线上版本和历史版本，确认要恢复的版本。
2. 向 Step Code 明确指定站点与目标版本，请求回滚。
3. 重新访问线上页面，验证回滚结果。

可以先请求回滚计划，不执行操作：

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
列出这个站点的最近版本和当前线上版本，给出回滚到上一稳定版本的操作计划，先不要执行。
```

## 管理入口

在[站点管理](https://platform.stepfun.com/sites)查看站点、版本和发布状态。托管额度、访问规则和平台限制以[静态托管文档](/docs/zh/guides/page-hosting)及账户实际状态为准，不应将 Step Plan 模型额度直接当作托管额度。
