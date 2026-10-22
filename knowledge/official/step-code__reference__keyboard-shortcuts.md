<!-- 官方文档快照: https://platform.stepfun.com/docs/zh/step-code/reference/keyboard-shortcuts 抓取日期: 2026-10-19 -->
来源: https://platform.stepfun.com/docs/zh/step-code/reference/keyboard-shortcuts

# 键盘快捷键

使用 `/hotkeys` 查看当前快捷键。部分组合键受操作系统和终端设置影响，遇到冲突时可使用替代键或修改键位。

## 输入与编辑

| 快捷键 | 作用 |
| - | - |
| Enter | 发送输入 |
| Shift+Enter、Alt+Enter、Ctrl+J | 换行 |
| ↑ / ↓（空输入框） | 浏览输入历史 |
| Home / Ctrl+A；End / Ctrl+E | 移动到行首或行尾 |
| Alt+← / →、Ctrl+← / → | 按词移动 |
| Ctrl+] / Ctrl+Alt+] | 向前或向后跳到指定字符 |
| Backspace；Delete / Ctrl+D | 向后或向前删除字符 |
| Ctrl+W / Alt+Backspace；Alt+D | 向后或向前删除词 |
| Ctrl+U；Ctrl+K | 删除到行首或行尾 |
| Ctrl+Y、Alt+Y | 恢复删除内容，或切换删除记录 |
| Ctrl+- | 撤销；Windows 使用 Ctrl+Z，WSL 使用 Alt+Z |

输入框和消息队列的使用方式见[交互与任务控制](/docs/zh/step-code/guides/interaction)。

## 全局与应用

| 快捷键 | 作用 |
| - | - |
| Esc | 中断输出或取消当前操作 |
| Ctrl+C | 清空输入；输入为空时退出 |
| Ctrl+D | 空输入框时退出 |
| Ctrl+Z | 将进程挂起到后台，原生 Windows 不适用 |
| Ctrl+G | 打开外部编辑器 |
| Ctrl+V | 粘贴图片；Windows / WSL 使用 Alt+V |

## 模型与输出

| 快捷键 | 作用 |
| - | - |
| Ctrl+L | 重绘屏幕 |
| Ctrl+P | 切换到下一个已选模型 |
| Shift+Ctrl+P | 切换到上一个模型；Windows / WSL 使用 Alt+P |
| Shift+Tab | 循环权限模式 |
| Ctrl+T | 折叠或展开思考块 |
| Ctrl+O | 折叠或展开工具输出 |
| Ctrl+X | 复制响应、所选消息或全屏选区，取决于当前界面 |
| Alt+↑ | 取回排队消息；Windows / WSL 使用 Alt+Q |

<a id="转录滚动与搜索（fullscreen-模式）" />

对应的交互命令见[斜杠命令](/docs/zh/step-code/reference/slash-commands)。

## 会话记录滚动与搜索（fullscreen 模式）

| 快捷键 | 作用 |
| - | - |
| Ctrl+End | 返回底部并跟随新输出 |
| PageUp / PageDown | 按页滚动 |
| Ctrl+Shift+F | 搜索会话记录；Windows / WSL 使用 Ctrl+F |
| Enter / Ctrl+G | 下一个搜索结果 |
| Shift+Enter | 上一个搜索结果 |
| Ctrl+Shift+↑ / ↓ | 跳到上一条或下一条标记消息 |

fullscreen 是实验性模式，可通过 `step --tui-mode fullscreen` 启动。

## /tree 内

| 快捷键 | 作用 |
| - | - |
| ↑ / ↓ | 浏览节点 |
| Enter | 选择节点 |
| Ctrl+← / →、Alt+← / → | 折叠或展开跳段 |
| Shift+L | 编辑标签 |
| Ctrl+O | 切换过滤器 |

## 选择器通用

方向键和 PageUp / PageDown 用于浏览，Enter 确认，Esc 取消。

`/resume` 选择器中，Ctrl+S 切换排序、Ctrl+N 筛选命名会话、Ctrl+R 重命名、Ctrl+D 删除。模型选择器中的 Ctrl+S 用于保存默认值；思考级别选择器按 Enter 即应用并保存默认值。

## 自定义

键位文件位于 `~/.stepcode/agent/keybindings.json`，动作名如 `tui.input.newLine`、`app.model.select`，修改后运行 `/reload`。例如，指定换行键：

```json theme={"theme":{"light":"light-plus","dark":"dark-plus"}}
{
  "tui.input.newLine": ["shift+enter", "ctrl+j"]
}
```

只覆盖需要调整的动作，避免同一上下文中绑定重复组合键。设置无效时，先检查终端是否拦截按键，再检查动作名称和 JSON 格式。

其他界面设置见[配置文件](/docs/zh/step-code/configuration/files)。
