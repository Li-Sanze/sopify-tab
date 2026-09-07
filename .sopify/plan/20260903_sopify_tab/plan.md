---
title: Sopify Tab 工作台与可选本机 CLI
plan_id: 20260903_sopify_tab
status: planned
lifecycle_state: planned
level: architecture
created: 2026-09-03
updated: 2026-09-07
archive_ready: false
---

# Sopify Tab 工作台与可选本机 CLI

就绪状态: Ready
依据: 方案已收口。原型画完整界面，不按 Wave 藏入口。Wave 1 书桌、Wave 2 设置 / 可选 Host、Wave 3 Side Panel 只读 ask 已落地（待合入）。

Plan Snapshot: 安静新标签页工作台，聊天可选。status=planned。Wave 3 实现中。knowledge_sync: project/background/design=required，tasks=review。

## Context / Why

打开 Chrome 新标签页时要先看到一张安静的个人书桌，而不是搜索框或聊天。需要时再对本机 Cursor CLI 做只读问答。商店包交付书桌；没装 Host 不是故障。

`prototype/index.html` 画完整界面：左栏书桌 / 标签 / 设置 / 对话常驻。Wave 只约束 `extension/` 交付顺序。草图栏、第三列占位、Host mock 和样例数据不进产品。

## Scope

本方案交付：

- Chrome MV3 扩展：新标签页左侧栏 + 主区。Wave 1 只有书桌、标签两页
- 书桌：跟随系统的日/夜外观、时钟与问候称呼、手填常用站、极简待办、纯文本便签、当前窗口域名摘要
- 标签页：当前窗口按域名分组、标题/网址筛选、关闭单条、关闭整组；localhost 端口只当标签
- Wave 2 才出现设置页：连接本机 Host、工作目录（默认空）
- Wave 3 才出现左侧栏「对话」和工具栏入口，打开同一 Side Panel；演示第三列不进 `newtab` DOM
- 可选 `nativeMessaging`：用户在设置里点连接后再申请
- 本机 native host + `install-host.sh`：快照 Node 与 `cursor-agent-proxy` 绝对路径；ask 流式只接通这一条
- 稳定扩展 `key`，host `allowed_origins` 只允许本扩展
- 关侧栏结束 native port，并杀掉整棵子进程树

不在本方案内：Chrome 网上应用店实际上架操作、CLI 选择器、模型列表、Claude / Codex 检测或问答、可写执行、微信读书、天气、音乐、番茄钟、富文本、收藏夹、历史作为第一屏、标签跳转/去重、手动日夜切换、`chrome.storage.sync`、把书桌数据写到 Host 文件、Prompt / Skill 库、Agent Pocket 入口或暗示（Agent Pocket 是独立 macOS App，另仓另方案）。

## Approach

Vanilla MV3。会话放在 Side Panel 文档里，因为 `chrome_url_overrides` 一点常用站就会卸掉。Host 不进 CRX。问答只 spawn `/Users/weixin.li/.local/bin/cursor-agent-proxy`，加 `--print --output-format stream-json --mode ask`，cwd 为设置里的工作目录。不传 `--force`。

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
| 当前窗口标签 | 不落盘。`chrome.tabs` 现查 | Wave 1 |
| 当次对话 | Side Panel 文档内存 | Wave 3 |
| Host 是否在 | 运行时探测，不落盘 | Wave 2 |

## Waves / Steps

- [x] Wave 1：书桌与标签。左侧栏两页、书桌四块、标签整理。权限仅 `storage`、`tabs`。无 Side Panel、无设置、无 Host 文案。
- [x] Wave 2：设置页（连接本机 + 工作目录）；可选申请 `nativeMessaging`；`host/install-host.sh`。Host 失败不破坏书桌。本波停在 install + detect，ask 桥留到 Wave 3。
- [x] Wave 3：Side Panel、栏内对话、工具栏入口；Cursor ask 流式；停止 / 重试 / 新会话；关侧栏杀进程树。
- [ ] Wave 4：listing / 隐私披露验收文案（不实际上架）。实际上架操作另开方案。

## Key Decisions

- 品牌与仓库：Sopify Tab / `sopify-tab`。Host id：`com.sopify.tab`。商店短描述走「安静新标签页工作台」，不卖 AI workflow。
- 默认不连、第一屏不提 Host。问候旁芯片和左栏红点不做。对话入口要到能发送时才出现。
- 真对话在 Side Panel，不进 newtab DOM。
- 本方案只对接 Cursor。不做三 CLI 选择器，不做模型列表，不检测 Claude / Codex。
- 标签按演示已有动作：分组、筛选、关闭。不做跳转、去重。
- 用户书桌数据只进 `chrome.storage.local`。标签不存。对话不存。
- 不接 Multica。聊天自研薄层。
- 桥：Side Panel + Native Messaging。第一版不做常驻 sidecar。
- `nativeMessaging` 可选。Host 不进商店包。
- 许可证默认 MIT。
- 用户主动进入设置或侧栏时，文案必须写清：只读本机 Cursor CLI、另装 Host、不是本地模型、不能写执行。
- 「不卖 AI workflow」指 listing 不以聊天当主卖点，不是隐藏可选聊天。

## Constraints / Not-in-scope

- 不得覆盖本机已有 `com.openai.codexextension`、`com.qoder.work.connector` 清单。
- 不得快照 `~/.local/share/cursor-agent/versions/...`。
- Host 不得依赖 `/usr/bin/env node` 或 Chrome GUI 的 PATH。
- 关侧栏必须杀掉整棵子进程树，不能只 disconnect port。
- 公开品牌碰撞：sopifyapp.com、evidentloop/sopify、CWS「Scrape Sopify」。listing 不得暗示 SOP SaaS 或 Shopify 抓取。
- 不把本项目放进 `/Users/weixin.li/code/nio/Multica`。工作目录默认空，不预填路径。
- 不用 `chrome.storage.sync`，不把待办 / 便签 / 常用站写到磁盘文件或 Host。

## Status / Progress

- [x] 需求锁定，评分 9/10
- [x] 架构路径确认（侧栏 + Native Messaging，ask 只读）
- [x] 默认不连、第一屏不提 Host
- [x] Wave 1 扩展代码
- [x] Wave 2 设置页与可选 Host（install + detect）
- [x] Wave 3 Side Panel 只读 ask（实现中，等 PR）

## Next

Wave 3 已实现 Side Panel 与 ask 流式，等 PR 审序。下一波做 Wave 4 listing / 隐私披露草稿，不实际上架。
