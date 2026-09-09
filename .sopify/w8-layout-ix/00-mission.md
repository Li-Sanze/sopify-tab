# W8 布局与交互

小组已锁：书桌优先的布局 + 交互打磨。要酷炫美观、少文字、不挡用；不做小组件墙。本文档随文档 PR 落仓。实现另开 PR，本文件不代替代码。

## 目标

把 NTP / Side Panel 的间距、玻璃量级、卡片悬停、设置/侧栏文案密度，以及左栏「对话」入口，对齐到 `prototype/` 与 ADR-006。不新开模块，不重做天空。

## 非目标

- 不做 WebGL / Canvas
- 不新开模块、不做小组件墙
- 不改 Host / W6 上游
- 不回滚 #20 天空
- 除非用户可见事实必须补一句，不重写 README
- 不把聊天 DOM 放回 newtab

## 单一事实来源（SoT）

间距、玻璃、阴影、deskhead、卡片悬停以 `prototype/index.html` 为准。对话入口以 ADR-006 为准：Host 能发送才显示或强调。

`prototype/index.html` 仍是视觉参考，不是模块或 Host 合同。草图栏、第三列、样例数据不进产品。

## 基线

**保留 #20。** W7 已合的天空透视 / DOM 本波不碰。对照 main `57bf3b3` vs `prototype/`：`.deskgrid` / `.settings` / `.groups` 的 gap 为 14px（原型 18px）；夜 `--glass` 为 `0.8`（原型 `0.66`）；`.card.group:hover` 仍 `translateY(-1px)`；`#open-chat` 始终可见，与 ADR-006 不符。

## 合闸

1. **文档 PR（本 PR）**：只落 `.sopify/w8-layout-ix/` 与 wave-board 短表。无 `extension/**`、`host/**`。
2. **实现 PR（后开）**：等本文档合入后再开。只做五项 DoD；可选磁贴删除热区默认不做。
3. **Sanze** unpacked 点验后合实现 PR；**Rick** 翻 `wave-board.md`。

不得跳步。实现 PR 等文档合入。

## 验收（实现 PR 合入前；本 PR 不勾完成）

| 项 | 内容 |
| --- | --- |
| 间距 | desk / settings / groups gap = 18px；deskhead margin/gap = 26 / 18×24 |
| 玻璃 | `theme.css` 日夜 `--glass` / `--glass-hi` / `--shadow-*` 对齐原型量级；NTP + Side Panel 同一表；不碰 W7 天空透视 / DOM |
| 悬停 | `.card.group:hover` 去掉 `translateY`，只抬阴影；尊重 `prefers-reduced-motion` |
| 文案 | 设置 / 侧栏：每条 help / note / viewhead / guard / empty / hint ≤ 一句或一枚 chip；事实保留 |
| 对话入口 | 左栏「对话」`#open-chat` 仅在 Host 能发送时显示或强调（ADR-006 / `hostConnected`）；无新权限 / 存储 |
| 范围 | 无 WebGL/Canvas、无新模块/小组件墙、无 Host/W6 改动、#20 天空未回滚、聊天 DOM 不回 newtab |

审序（任一 PR 后）：工程 → UI → 产品 → 技术总监；各一句「过/改」。
