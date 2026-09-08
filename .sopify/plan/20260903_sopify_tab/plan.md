---
title: Sopify Tab 工作台与可选本机 CLI
plan_id: 20260903_sopify_tab
status: planned
lifecycle_state: planned
level: architecture
created: 2026-09-03
updated: 2026-09-08
archive_ready: false
---

# Sopify Tab 工作台与可选本机 CLI

就绪状态: Ready
依据: 方案已收口。原型画完整界面，不按 Wave 藏入口。Wave 1 书桌、Wave 2 设置 / 可选 Host、Wave 3 Side Panel 只读 ask 已落地。Wave 4 已合（#11 / 6da0acc）。Wave 6 多 CLI Host 另立项，本波先落文档；W5 listing 仍暂停。

Plan Snapshot: 安静新标签页工作台，聊天可选。status=planned。Wave 6 文档落仓中；实现另开 PR。W5 listing 仍暂停。knowledge_sync: project/background/design=required，tasks=review。

## Context / Why

打开 Chrome 新标签页时要先看到一张安静的个人书桌，而不是搜索框或聊天。需要时再对本机已选 CLI（默认 Cursor）做只读问答。商店包交付书桌；没装 Host 不是故障。

`prototype/index.html` 画完整界面：左栏书桌 / 标签 / 设置 / 对话常驻。Wave 只约束 `extension/` 交付顺序。草图栏、第三列占位、Host mock 和样例数据不进产品。

## Scope

本方案交付：

- Chrome MV3 扩展：新标签页左侧栏 + 主区。Wave 1 只有书桌、标签两页
- 书桌：时钟与问候称呼、手填常用站、极简待办、纯文本便签、当前窗口域名摘要；外观由内置预设（`system` / `day` / `night`，默认 `system`）经 CSS 变量驱动，设置页切换（ADR-007；实现在 Wave 4）
- 标签页：当前窗口按域名分组、标题/网址筛选、关闭单条、关闭整组；localhost 端口只当标签
- Wave 2 才出现设置页：连接本机 Host、工作目录（默认空）。Wave 4 再加「外观」一块（`system`/`day`/`night`；切预设即生效，不做预览墙）。Wave 6 再加设置深路径上游选择（默认 Cursor；不抢第一屏）
- Wave 3 才出现左侧栏「对话」和工具栏入口，打开同一 Side Panel；演示第三列不进 `newtab` DOM
- 可选 `nativeMessaging`：用户在设置里点连接后再申请
- 本机 native host + `install-host.sh`：快照 Node 与上游绝对路径；默认 ask 仍接通 `cursor-agent-proxy`。Wave 6 另立项：同一 Side Panel 合同下用薄配置表再接已声明上游（首扩 Claude Code CLI 只读；见 ADR-008）
- 稳定扩展 `key`，host `allowed_origins` 只允许本扩展
- 关侧栏结束 native port，并杀掉整棵子进程树

不在本方案内：Chrome 网上应用店实际上架操作、模型列表、未接线 Host（Codex / Grok / DeepSeek 等属后续波）、任意本机 Agent、webhook 框架、空壳适配、第二套 Side Panel 协议、可写执行、微信读书、天气、音乐、番茄钟、富文本、收藏夹、历史作为第一屏、标签跳转/去重、主题商店、壁纸/视频底、用户自定义 CSS、WebGL 天空、NTP 内嵌聊天、扩展内代理配置 UI、`chrome.storage.sync`、把书桌数据写到 Host 文件、Prompt / Skill 库、Agent Pocket 入口或暗示（Agent Pocket 是独立 macOS App，另仓另方案）。W6 范围内：同合同多 Host 薄适配、设置深路径上游选择、Claude Code CLI 只读（ADR-008）。设置页内置预设 `system`/`day`/`night` 在范围内（ADR-007）；`soft`∉W4 DoD。详细收口见 `plan-w6-delta.md`。

## Approach

Vanilla MV3。会话放在 Side Panel 文档里，因为 `chrome_url_overrides` 一点常用站就会卸掉。Host 不进 CRX。默认问答 spawn `/Users/weixin.li/.local/bin/cursor-agent-proxy`，加 `--print --output-format stream-json --mode ask`，cwd 为设置里的工作目录。不传 `--force`。W6 起 Host 可按薄表 spawn 已声明上游（默认仍是这一条）；Side Panel 合同不变。图在实现波再改，见 `plan-w6-delta.md`。

```text
新标签页 (左侧栏：书桌 / 标签；Wave 2 起加设置)
    └─ Wave 3：栏内「对话」/ 工具栏 ──► Side Panel
                                              │
                                              ▼ chrome.runtime.connectNative
                                     native host
                                              │
                                              ▼ cursor-agent-proxy --print --output-format stream-json --mode ask
```

默认不连。第一屏（书桌）不出现 Host 芯片、连接灯、「未检测到」或对话按钮。「没连 Host」不是状态，只在用户主动打开设置或（Wave 3 之后）Side Panel 时写成说明。

本机数据落点（ADR-005）：

| 信息 | 存在哪 | 何时写入 |
| --- | --- | --- |
| 常用站、待办、便签、称呼 | `chrome.storage.local` | Wave 1 |
| 工作目录 | `chrome.storage.local`，默认空 | Wave 2 |
| 外观预设 | `chrome.storage.local`（如 `themePreset`），默认 `system`；不进 `sync` | Wave 4 |
| 上游 id | `chrome.storage.local`（`hostUpstream`：`cursor` \| `claude`），默认 `cursor`；不进 `sync` | Wave 6（实现时） |
| 当前窗口标签 | 不落盘。`chrome.tabs` 现查 | Wave 1 |
| 当次对话 | Side Panel 文档内存 | Wave 3 |
| Host 是否在 | 运行时探测，不落盘 | Wave 2 |

## Waves / Steps

- [x] Wave 1：书桌与标签。左侧栏两页、书桌四块、标签整理。权限仅 `storage`、`tabs`。无 Side Panel、无设置、无 Host 文案。
- [x] Wave 2：设置页（连接本机 + 工作目录）；可选申请 `nativeMessaging`；`host/install-host.sh`。Host 失败不破坏书桌。本波停在 install + detect，ask 桥留到 Wave 3。
- [x] Wave 3：Side Panel、栏内对话、工具栏入口；Cursor ask 流式；停止 / 重试 / 新会话；关侧栏杀进程树。
- [x] Wave 4：换肤（内置预设 system/day/night + CSS 变量 + 启动防闪）与克制优化（空态/信息克制可砍；README 代理一句）。见 ADR-007、wave-4-brief.md。已合 PR #11（`6da0acc`）；5.4 未做。
- [ ] Wave 5：listing / 隐私披露验收文案（不实际上架）。**仍暂停**，不挡 W6。实际上架操作另开方案。
- [ ] Wave 6：多 CLI Host（另立项）。同一 Side Panel 合同 + 薄配置表；默认 Cursor；首扩 Claude Code CLI 只读。见 ADR-008、wave-6-brief.md、tasks-w6.md。

## Key Decisions

- 品牌与仓库：Sopify Tab / `sopify-tab`。Host id：`com.sopify.tab`。商店短描述走「安静新标签页工作台」，不卖 AI workflow。
- 默认不连、第一屏不提 Host。问候旁芯片和左栏红点不做。对话入口要到能发送时才出现。
- 真对话在 Side Panel，不进 newtab DOM。
- 默认上游仍是 Cursor。W6 另立项：同一 Side Panel 合同下用薄配置表接线已声明上游；选择器只在设置深路径。不做第一屏模型墙，不写「任意本机 Agent」。Claude 只读身份表见 wave-6-brief.md。Codex / Grok / DeepSeek 不在本波。
- 标签按演示已有动作：分组、筛选、关闭。不做跳转、去重。
- 用户书桌数据只进 `chrome.storage.local`。标签不存。对话不存。
- 不接 Multica。聊天自研薄层。
- 桥：Side Panel + Native Messaging。第一版不做常驻 sidecar。
- `nativeMessaging` 可选。Host 不进商店包。
- 许可证默认 MIT。
- 用户主动进入设置或侧栏时，文案必须写清：只读本机已选 CLI（默认 Cursor）、另装 Host、不是本地模型、不能写执行。
- 「不卖 AI workflow」指 listing 不以聊天当主卖点，不是隐藏可选聊天。
- ADR-007（2026-09-07 审计通过）：换肤仅内置预设 `system` | `day` | `night`（`soft`∉W4 DoD）；只走 CSS 变量 + 根节点属性；预设写入 `storage.local`，默认 `system`，不进 `sync`。
- 即时预览 = 设置页切预设立即生效；不是缩略图 / 预览墙。书桌第一屏不放主题入口。
- `newtab` 与 Side Panel 必须共用同一套 CSS 变量表（设置亮、侧栏暗 = 不过）。
- 启动防闪：首屏 paint 前同步写根节点；禁止先闪系统默认再异步跳预设。
- 零新权限；无 `chrome.proxy`、无远程主题。Wave 3 Side Panel 合同不变。
- Wave 4 执行序：文档 PR → 实现 PR → Sanze 点验。`tasks` 5.4 可砍、不挡合闸。listing 属 Wave 5，仍暂停。
- ADR-008（2026-09-08 身份表过审）：多 Host 薄适配；无空壳 / 第二协议 / webhook；同时只跑一个 Host；README 只列已接线（实现波改）。W6 执行序：文档 PR → 实现 PR → Sanze 点验。

## Constraints / Not-in-scope

- 不得覆盖本机已有 `com.openai.codexextension`、`com.qoder.work.connector` 清单。
- 不得快照 `~/.local/share/cursor-agent/versions/...`。
- Host 不得依赖 `/usr/bin/env node` 或 Chrome GUI 的 PATH。
- 关侧栏必须杀掉整棵子进程树，不能只 disconnect port。
- 公开品牌碰撞：sopifyapp.com、evidentloop/sopify、CWS「Scrape Sopify」。listing 不得暗示 SOP SaaS 或 Shopify 抓取。
- 不把本项目放进 `/Users/weixin.li/code/nio/Multica`。工作目录默认空，不预填路径。
- 不用 `chrome.storage.sync`，不把待办 / 便签 / 常用站 / 外观预设写到磁盘文件或 Host。
- 主题商店、壁纸/视频底、用户自定义 CSS、WebGL 天空仍为范围外。允许设置页内置预设，不再把「手动日夜」列为禁止项。
- 不得为未接线 CLI 预留空壳 spawn；不得引入 webhook 或第二套 Side Panel 协议；不得写成「任意本机 Agent」。

## Status / Progress

- [x] 需求锁定，评分 9/10
- [x] 架构路径确认（侧栏 + Native Messaging，ask 只读）
- [x] 默认不连、第一屏不提 Host
- [x] Wave 1 扩展代码
- [x] Wave 2 设置页与可选 Host（install + detect）
- [x] Wave 3 Side Panel 只读 ask（已合入 main，PR #6）
- [x] Wave 4 文档落仓（ADR-007 / wave-4-brief / plan / tasks / wave-board / preferences；#10 / 1adbacd）
- [x] Wave 4 实现（PR #11 / `6da0acc`；A + C；B / 5.4 未做）
- [ ] Wave 6 文档落仓（ADR-008 / wave-6-brief / tasks-w6 / plan-w6-delta / preferences-w6-delta / wave-board）
- [ ] Wave 6 实现（文档合入后另开 PR；本处不勾）

## Next

W6 文档本 PR 落仓。W5 listing 仍暂停。下一动作是实现 PR（Cursor 回归 + 薄配置表 + Claude 只读）。Sanze unpacked 点验后合实现 PR。
