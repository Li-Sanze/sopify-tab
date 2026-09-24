# 首屏 v3 窄屏返工（tip 2ade780）

拍法：Playwright Chromium headed，`--load-extension` 指向仓库 `extension/`。扩展 ID `cgkhllpelkjmfamddkjpnmchjikdcbgp`。页面是 `chrome-extension://…/newtab.html`。

上一轮 `390de7e` 的 `filled-day-w600` 视口宽度是 600，但 `max-width: 600px` 没生效（visualViewport 约 600.4），画面仍是两栏、品牌全文、问候一行。那张图不能当单栏验收。本 tip 把断点改成 `max-width: 600.98px` 后重拍。

| 项 | 结果 | 说明 |
|---|---|---|
| 视口 600 单栏 | 通过 | `filled-day-w600-2ade780.png`（600×900）。三列 top 为 388 / 604 / 820，`grid-template-columns` 为一条 `532.317px`。 |
| 视口 600 品牌 mark-only | 通过 | 同一张图。`.studio-brand-name` 的 display 为 `none`，顶栏只剩 mark。 |
| 视口 600 问候分行 | 通过 | 同一张图。`#greet-word` 的 display 为 `block`，问候单独一行，日期和时刻在下一行。 |
| 601 仍两栏 | 通过（未出图） | 视口 601 时 `max-width: 600.98px` 不命中，grid 为两列，品牌 display 为 `block`。 |
| 1280 三栏未受影响 | 通过（未出新图） | 同一 tip、有数据，grid 为 `320px 320px 320px`，三列 top 都是 382。未重拍 filled day/night。 |
| 空态无全框焦点描边 | 通过 | `empty-day-2ade780.png`。拍前 blur，activeElement 为 BODY，输入框 outline 与 box-shadow 均为 none，只剩底边线。 |
