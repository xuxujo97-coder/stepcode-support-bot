<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/customization/themes 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/customization/themes

# 自定义主题

Step Code 自带六套主题，也可以用 JSON 文件定义自己的配色：放入主题目录后即可在 `/theme` 中选择，修改当前主题会即时热重载。

## 内置主题

| 主题 | 用途 |
| - | - |
| `step-blue` | 默认蓝色主题 |
| `step-violet` | 深色终端紫色主题 |
| `step-violet-light` | 浅色终端紫色主题 |
| `dark`、`light` | 通用深色和浅色主题 |
| `sage` | 深色终端绿色主题 |

## 切换主题

```text theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
/theme
/theme sage
```

也可在配置文件中设置：

```toml theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
theme = "sage"
```

仅对一次启动生效：

```bash theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
step --use-theme light
```

`/theme` 打开选择器，自定义主题即时可用，无需重启；`/theme <名称>` 直接切换。编辑当前使用的主题文件会热重载。

<a id="statustips" />

工作行提示通过 `config.toml` 的 `statusTips` 设置，见[配置文件](/docs/zh/step-code/configuration/files)。

## 主题文件

| 范围 | 路径 |
| - | - |
| 用户 | `~/.stepcode/agent/themes/*.json` |
| 项目 | `.stepcode/themes/*.json`，需要项目信任 |
| 包 | 资源包中的主题目录 |
| 启动参数 | `--theme <路径>`，可重复 |

文件名即主题名，例如 `my-theme.json`。放入目录后，自定义主题与内置主题一起出现在 `/theme` 中。建议以完整主题为起点，保留全部颜色字段后再调整配色。

通过资源包分发主题的方式见[插件与 Packages](/docs/zh/step-code/customization/plugins)。

## 主题 JSON 格式

主题由 `name`、可复用颜色变量 `vars` 和颜色映射 `colors` 组成。以下示例仅展示部分字段，不能直接作为完整主题使用：

```json theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
{
  "name": "my-theme",
  "vars": {"primary": "#7aa2f7"},
  "colors": {
    "accent": "primary",
    "text": "#c0caf5",
    "mdTableHeader": "#9d7cd8",
    "syntaxKeyword": "#bb9af7"
  }
}
```

完整主题需定义全部 52 个颜色 token，覆盖核心 UI、背景与内容、Markdown、diff、语法高亮、thinking 边框和 bashMode。

| 颜色值 | 含义 |
| - | - |
| `"#ff0000"` | 六位十六进制颜色 |
| `39` | xterm 256 色索引 |
| `"primary"` | 引用 `vars` 中的变量 |
| `""` | 使用终端默认颜色 |

支持真彩色的终端使用 24-bit 颜色；其他终端可能回退为接近的 256 色。

暗色终端宜选明亮且饱和的颜色，亮色终端宜选较暗且低饱和的颜色；公共基色放入 `vars` 复用。

## 出错时的行为

非法色值会使整份主题加载失败并回退到内置 `dark`；热重载中瞬时出错则保持当前主题不变。请检查 JSON 语法、颜色值、变量引用和字段完整性。
