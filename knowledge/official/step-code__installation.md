<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/installation 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/installation

# 升级

首次安装见[快速开始](/docs/zh/step-code/quickstart)。

## 环境要求

* macOS 或 Linux 使用 Bash 命令。
* Windows PowerShell 支持处于 beta 阶段，Windows 用户也可以在 WSL 中按 Linux 方式操作。
* 建议使用 Kitty、Ghostty、iTerm2 或 Windows Terminal。图片显示和部分组合键取决于终端支持。
* 安装和升级时需要访问发行服务，使用模型时需要访问对应的模型服务。

## 指定安装版本和目录

通常使用 `step update <版本号>` 更新到指定发行版本。需要自定义程序目录或使用安装器时，在 macOS 或 Linux 中先下载安装器，再指定安装参数：

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
curl -fsSL https://static-openapi.stepfun.com/stepcode/install.sh -o install-stepcode.sh
bash install-stepcode.sh --version latest --install-dir "$HOME/.local/stepcode/bin"
```

`latest` 安装最新版本；固定版本时，将其替换为实际发行版本。`--install-dir` 指定程序目录。也可使用以下环境变量：

| 变量 | 用途 |
| - | - |
| `STEP_RELEASE_BASE_URL` | 发行源 |
| `STEP_INSTALL_DIR` | 程序安装目录 |
| `STEP_CODING_AGENT_DIR` | Agent 资源目录 |

配置、凭据与会话的目录规则见[数据路径](/docs/zh/step-code/configuration/data-paths)。

## 升级 Step Code

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step update
```

`step upgrade` 是别名。安装指定发行版本的命令格式为 `step update <版本号>`。升级完成后，运行 `step --version` 核对版本；各版本的变化见[版本记录](/docs/zh/step-code/release-notes)。

## 卸载 Step Code

1. 退出 Step Code，备份需要保留的配置和会话。
2. 删除安装目录中的 `step` 可执行文件；Windows 对应 `step.exe`。
3. 从 Shell 配置或 Windows PATH 中移除安装目录。zsh、Bash 和 POSIX 登录配置中的安装器 PATH 块带有标记；fish 使用 `fish_add_path` 管理路径。

卸载程序后，配置、凭据和会话仍会保留。需要清理时，按[数据清理说明](/docs/zh/step-code/configuration/data-paths#清理数据)分别处理；不要删除与其他工具共用的目录。
