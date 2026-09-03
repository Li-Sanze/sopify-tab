---
title: Sopify Tab 工作台与可选本机 CLI
plan_id: 20260903_sopify_tab
status: planned
lifecycle_state: planned
level: architecture
created: 2026-09-03
updated: 2026-09-03
archive_ready: false
---

# Sopify Tab 工作台与可选本机 CLI

就绪状态: Needs decision
依据: 产品路径已经锁死。还差启动路径：先让 Codex 审这份落盘方案，还是直接开始 Wave 1。这一条会改「现在写不写扩展代码」，不改架构。

Plan Snapshot: 可 unpacked、可上架的安静新标签页工作台；本机 CLI 问答按可选能力接入。status=pending。下一步确认启动路径。当前任务是等待用户确认，不写扩展代码。knowledge_sync: project/background/design=required，tasks=review。

## Context / Why

打开 Chrome 新标签页时要先看到一张安静的个人书桌，而不是搜索框或聊天。需要时再从 Side Panel 对本机 coding CLI 做只读问答。商店包交付书桌；Host 和 CLI 缺失时书桌仍完整可用。这不是 Multica 克隆，也不是再跳到 ChatGPT 网页。

## Scope

本方案交付：

- Chrome MV3 扩展：新标签页书桌（时钟、手填常用站、极简待办、纯文本便签）
- 当前窗口按域名整理标签：跳转、关闭、去重；localhost 端口只当标签，不当 agent 上下文
- Side Panel 聊天 UI；FAB 从书桌打开
- 工具栏图标从任意页面打开同一 Side Panel
- 可选 `nativeMessaging`：用户点连接后再申请
- 本机 native host + `install-host.sh`：快照 Node 绝对路径，调用 `cursor-agent-proxy`，ask 模式只读
- 稳定扩展 `key`，host `allowed_origins` 只允许本扩展
- 关侧栏结束 native port，并杀掉整棵子进程树

不在本方案内：Chrome 网上应用店实际上架操作、多 CLI 选择器、可写执行、微信读书、天气、音乐、番茄钟、富文本、收藏夹、历史作为第一屏。

## Approach

Vanilla MV3，不引入 React 聊天栈，不 fork 乔木 Tab / Tab Out。会话放在 Side Panel 文档里，因为 `chrome_url_overrides` 一点常用站就会卸掉。Host 不进 CRX；install 脚本写入本机绝对路径，Chrome GUI 看不到 zsh alias 和 nvm。第一版只 spawn `/Users/weixin.li/.local/bin/cursor-agent-proxy`，加 `--print --output-format stream-json --mode ask`，cwd 为设置里的工作目录。不传 `--force`，不把版本目录写进配置。

```text
新标签页 (书桌 + 标签网格)
    └─ FAB / 工具栏 ──► Side Panel (薄聊天 UI)
                              │
                              ▼ chrome.runtime.connectNative
                     native host (install 写入的 Node 绝对路径)
                              │
                              ▼ cursor-agent-proxy --print --output-format stream-json --mode ask
```

## Waves / Steps

- [ ] Wave 1：商店就绪书桌。`manifest.json` 含稳定 `key`；权限仅 `storage`、`tabs`、`sidePanel`。时钟、常用站、待办、纯文本便签、当前窗口标签网格。工具栏打开 Side Panel。无 `nativeMessaging`。
- [ ] Wave 2：Side Panel 空态说明如何安装 Host；可选申请 `nativeMessaging`；`host/install-host.sh` 写入 Node 与 `cursor-agent-proxy` 绝对路径；Host 失败不破坏书桌。
- [ ] Wave 3：ask 模式流式输出；停止 / 重试 / 新会话；关侧栏杀进程树。验收：无 Host 时只有复制说明，书桌仍可用。
- [ ] Wave 4：本方案收口。上架 listing 与隐私说明另开方案。

## Key Decisions

- 品牌与仓库：Sopify Tab / `sopify-tab`。Host id：`com.sopify.tab`。商店短描述走「安静新标签页工作台」，不卖 AI workflow。
- 主任务是工作台。聊天是 FAB → Side Panel，不进新标签页 DOM。
- 不接 Multica。聊天自研薄层，不嵌 Open WebUI、LibreChat、assistant-ui。
- 桥：Side Panel + Native Messaging。不为本机常驻 sidecar 开第一版。
- Agent：`cursor-agent-proxy` + `--mode ask`。`--mode ask` 是 CLI 合同，不是 OS 沙箱；仍锁 cwd。
- `nativeMessaging` 可选权限。Host 不进商店包。
- 第一版不做历史第一屏、书签、多 CLI、`--force`、浏览器写盘。
- 许可证默认 MIT。
- Codex 已审过「落盘前」的对话方案，三条 must-fix 已并入上文。对这份书面方案的二次审计可选，不阻塞建仓。

## Constraints / Not-in-scope

- 不得覆盖本机已有 `com.openai.codexextension`、`com.qoder.work.connector` 清单。
- 不得快照 `~/.local/share/cursor-agent/versions/...`。
- Host 不得依赖 `/usr/bin/env node` 或 Chrome GUI 的 PATH。
- 关侧栏必须杀掉整棵子进程树，不能只 disconnect port。
- 公开品牌碰撞：sopifyapp.com、evidentloop/sopify、CWS「Scrape Sopify」。listing 不得暗示 SOP SaaS 或 Shopify 抓取。
- 不把本项目放进 `/Users/weixin.li/code/nio/Multica`。

## Status / Progress

- [x] 需求锁定，评分 9/10
- [x] 架构路径确认（侧栏 + Native Messaging，ask 只读）
- [x] Codex 对落盘前方案做过一次交叉审计
- [x] 仓库与 `.sopify` 方案包落盘
- [ ] 用户确认启动路径
- [ ] Wave 1 扩展代码

## Next

等待确认：先让 Codex 审 `.sopify/plan/20260903_sopify_tab/`，还是直接开始 Wave 1。确认前不写扩展代码、不 `git push`、不装 Host。
