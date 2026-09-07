# Wave 4 Brief：换肤 + 克制优化

## 状态

审计通过（小组 2026-09-07）；本文档随文档 PR 落仓。实现另开 PR，本文件不代替代码。

## 目标

在不破坏安静书桌（ADR-006）的前提下，用**一层 CSS 变量**落地内置外观预设。用户可在设置页于 `system` / `day` / `night` 之间切换；切预设即在 NTP 与 Side Panel 同时生效。启动须防闪（FOUC-safe）。Wave 3 Side Panel 合同不变。扩展不提供代理配置；README 代理一句记入本波要求，**改 README 正文属于实现 PR**。

## DoD（必须同时满足）

- 预设 **仅** `system` | `day` | `night`。`soft` **不属于** W4 DoD，不得当成本波验收项或第三套「柔和」皮肤。
- 启动防闪：首屏 paint 前同步写根节点属性；禁止先闪系统默认再异步跳到已存预设。
- 入口只在设置页「外观」；书桌第一屏不放主题商店、不放预览墙。
- **即时预览 = 切换预设立刻生效**；不是缩略图 / 预览墙。
- `newtab` 与 Side Panel **必须共用同一套 CSS 变量表**（设置亮、侧栏暗 = 不过）。
- 零新权限；无 `chrome.proxy`、无远程主题拉取。
- Wave 3 Side Panel 合同不变（只读 ask、关栏杀进程树、对话不落盘、第一屏不提 Host）。
- README 须有代理一句（网络问题归本机 Host / 环境，扩展不提供代理配置）。**本文档 PR 只把该要求记入 plan / tasks；改 README 在实现 PR。**

## 非目标

- 主题商店
- 壁纸 / 视频底
- 用户自定义 CSS
- WebGL 天空
- NTP 内嵌聊天（含右栏「主题配套」）
- 扩展内代理配置 UI
- 商店 listing / 上架操作（顺延 Wave 5；实际上架另开方案）

## 钉死项（须在 plan / tasks / ADR-007 / wave-board / preferences 同时成立）

1. DoD 预设 **仅** `system` | `day` | `night`。`soft`∉W4 DoD。
2. 即时预览 = 切预设即生效；**不是**缩略图 / 预览墙。
3. NTP 与 Side Panel 共用同一套 CSS 变量表。
4. `tasks` 5.4 可砍、可选，**不得挡住合闸**。
5. 执行顺序：文档 PR（本 PR）→ 实现 PR → Sanze 点验。本 PR **仅文档**。
6. listing / 商店草稿从 Wave 4 **挪到 Wave 5**。
7. Wave board 更新人是 **Rick**（不是 JARVIS）。

## 范围拆分

### A（必须，实现 PR）

- 内置预设 `system` | `day` | `night`；默认 `system`；id 写入 `chrome.storage.local`（如 `themePreset`），不进 `sync`。
- 换肤只走 CSS 变量 + `data-theme`（或复用 / 扩展 `data-sky`）。不引入图片壁纸包。
- `sky.js`（或等价极短阻塞脚本）在 `<head>` 最前、首屏 paint 前同步读最小键并写根节点。禁止 paint-then-async。
- 设置页「外观」一块：三选一切换，切完立即应用到 NTP 与 Side Panel。
- NTP 与 Side Panel 引用**同一套**变量名与语义（同一张表；禁止各写各的日夜值导致分叉）。
- 零新权限；不改 Wave 3 桥、进程树、可选 `nativeMessaging` 时机。

### B（可选 / 可砍 / 不挡合闸）

- 空态与信息层次的克制打磨（对应 `tasks` **5.4**）。
- 可整项砍掉。合闸只看 A + C + 钉死项，不看 5.4。

### C（必须记要求；改文件在实现 PR）

- README 增加代理一句：扩展不提供代理配置；连不上 / 网络问题归本机 Host 或环境。
- **本 PR 不改 README 正文。** `tasks` 5.5 只记账；实现 PR 落这一句。

## 验收（实现 PR 合入前；本 PR 不勾完成）

| 项 | 内容 | 所有者 |
| --- | --- | --- |
| V1 | 预设仅 `system`/`day`/`night`；`storage.local` 落盘；启动早写，无 paint-then-async 闪跳。 | 工程 |
| V2 | 三预设观感可辨；切预设即生效；无预览墙；入口不抢书桌第一屏。 | UI |
| V3 | 非目标成立；换肤不破坏「默认不连、第一屏不提 Host」；不出现商店 / 壁纸 / 自定义 CSS。 | 产品 |
| V4 | NTP 与 Side Panel 共用同一 CSS 变量表；W3 Side Panel 合同未改。 | 工程 / 技术总监 |
| V5 | 零新权限；无 `chrome.proxy`、无远程主题；5.5 README 代理一句已在实现 PR 落地。 | 工程 |
| V6 | listing 不在本波（W5）；5.4 可砍且未挡合闸；执行序为文档 → 实现 → Sanze 点验。 | 产品 / 技术总监 |

审序（任一 PR 后）：工程 → UI → 产品 → 技术总监；各一句「过/改」。

## 执行顺序

1. **文档 PR（本 PR）**：`.sopify/` 内 plan / tasks / ADR-007 / 本 brief / wave-board / preferences 对齐钉死项。无 `extension/**`、`host/**`、无 README 功能改动。
2. **实现 PR（后开）**：A + C；B 可砍。
3. **Sanze** unpacked 点验后合实现 PR；**Rick** 翻 `wave-board.md`。

不得跳步：实现 PR 等文档合入。本 PR 不合实现、不改扩展代码。

## 依赖

- Wave 4 依赖 Wave 3 已合入 main（PR #6）。
- 实现依赖本 brief / ADR-007 落仓。
- Wave 5 listing 不挡 Wave 4 合闸。

## 共用 CSS 变量表（合同）

实现时须抽出（或等价复制并保持同步）NTP 与 Side Panel 共用的语义变量，至少覆盖现有书桌 / 侧栏已消费的色与材质，例如：`--sky-top` `--sky-mid` `--sky-low`、`--ink` `--ink-2` `--ink-3`、`--sky-ink*`、`--accent` `--accent-ink` `--accent-soft`、`--ok` `--warn` `--danger`、`--glass` `--struct` 及 edge / tile / field / line / well / shadow / glow / mist。预设只改这些变量与根节点 `color-scheme` / `data-sky`（或 `data-theme`），不另开 Side Panel 私有日夜表。

`system`：跟随 `prefers-color-scheme`。`day` / `night`：强制对应变量集，忽略系统偏好。

## 实现触达（实现 PR，本 PR 不改）

- `extension/sky.js`、`newtab.html` / `sidepanel.html` 的 `<head>` 顺序
- `newtab.css` 变量表；`sidepanel.css` 改为消费同一表
- 设置页「外观」
- README 代理一句（5.5）

## 参考

- ADR-007（换肤仅 CSS 变量 + 启动早写）
- ADR-006（默认不连，第一屏不提 Host）
- `plan.md` Waves 4–5、`tasks.md` §5 / §6
