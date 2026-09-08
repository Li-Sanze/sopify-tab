# W7 天空对齐原型

小组已锁：先 CSS + SVG。Sanze 要原型那种 3D 感；本波只把 NTP / Side Panel 的天空深度对齐到 `prototype/` 透视舞台。本文档随文档 PR 落仓。实现另开 PR，本文件不代替代码。

## 目标

把新标签页与 Side Panel 的天空深度，对齐到原型里已经画好的 **CSS + SVG 透视舞台**（`perspective` + `translateZ` 分层：远的小、软、慢，近的大、清、快）。日夜仍走既有 `system` | `day` | `night`。观感以原型为准，不是另开一套墙纸。

## 非目标

- 不改书桌模块、布局、左栏或 Host / Side Panel 合同
- 不做壁纸商店、视频底、用户自定义 CSS
- 默认不做 WebGL / Canvas（本波锁定 CSS + SVG；不引入粒子库）
- 不改 Wave 3 / Wave 6 接线；不碰 W5 listing

## 单一事实来源（SoT）

天空深度与日夜分层以这两处为准，实现对照，不另发明一套：

- `prototype/index.html`（透视舞台、日夜层、reduced-motion）
- `prototype/shots`（`day.png` / `night.png` / `desk.png` 等静帧）

`prototype/index.html` 仍是视觉参考，不是模块或 Host 合同。草图栏、第三列、样例数据不进产品。

## 基线

**保留 #17。** 已合的 CSS-only 分层天空、夜星野 / 极光、安静远环、启动早写、同一套 token 表，本波不回滚、不推倒重来。W7 是在 #17 上把深度对齐到原型透视舞台，不是换引擎。

## 合闸

1. **文档 PR（本 PR）**：只落 `.sopify/w7-sky-align/` 与 wave-board 短表。无 `extension/**`、`host/**`，不改 README 功能列表。
2. **实现 PR（后开）**：等本文档合入后再开。只动天空深度（CSS + SVG），不改模块 / 布局 / Host。
3. **Sanze** unpacked 点验后合实现 PR；**Rick** 翻 `wave-board.md`。

不得跳步。实现 PR 等文档合入。

## 验收（实现 PR 合入前；本 PR 不勾完成）

| 项 | 内容 |
| --- | --- |
| 安静书桌优先 | 天空在玻璃模块与时钟之后；不挡时钟、不抢第一屏、不增第一屏铬件 |
| Still | `prefers-reduced-motion` → **Still**（停漂、停闪）；默认 Calm 可极慢漂 |
| 对齐 | NTP 与 Side Panel 同一深度语言；对照 SoT，不是各写各的天 |
| 基线 | #17 仍在：无回滚、无默认 WebGL/Canvas、无壁纸店 |
| 范围 | 模块 / 布局 / Host 未改 |

审序（任一 PR 后）：工程 → UI → 产品 → 技术总监；各一句「过/改」。
