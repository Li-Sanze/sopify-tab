# ADR-008: 多 Host 薄适配（同一 Side Panel 合同）

## 状态
已采纳（工程 / 产品 / UI / 技术总监已过 Claude 只读身份表；2026-09-08；落仓文档 PR 须勾钉死项）

## 上下文
W3 把问答钉在一条 Cursor spawn 上。要扩上游，但不能把 Side Panel 改成第二套协议，也不能做成 webhook 平台或「任意本机 Agent」。ADR-002 写过「本方案只对接 Cursor；其它 CLI 另开方案」——W6 即该另开方案，且只扩已声明、已过审的只读上游。

## 决策
1. **同一消息合同**。Side Panel ↔ Host 仍是 `detect` / `ask` / `stop` / `shutdown` 与既有回包（`ask_start` / `ask_delta` / `ask_done` / `stopped` / `error` / `pong`）。`ask` 可带可选 `upstream`（缺省 `cursor`）。不新开消息类型，不新开端口。
2. **薄配置表 + 一套 spawn/parser / 已接线上游**。表行 = `{ id, bin, argv, parser }`。本波只接线 `cursor` 与 `claude`。未接线行不存在。
3. **禁止空壳 / 第二协议 / webhook 框架**。不得为「以后好接」预留会执行的占位 spawn、通用命令行、入站 HTTP。
4. **选择器只在设置深路径**。`storage.local.hostUpstream`：`cursor` \| `claude`，默认 `cursor`，不进 `sync`。第一屏、左栏、问候旁不放上游或模型墙。
5. **同时只跑一个 Host**。切上游先停当前进程树再 spawn；不并行双 agent。
6. **README 只列已接线 Host**。实现波改 README；未接线名称不进产品文案。不得写成「支持任意 CLI」。
7. **默认仍是 Cursor**。Cursor 回归失败 = W6 失败。
8. **Claude 只读身份表钉死**（argv 见 `wave-6-brief.md` / `tasks-w6.md` 7.4）。allow 仅 `Read`；`--permission-mode dontAsk`；`--bare`；禁止 Edit/Write/Bash、acceptEdits、bypassPermissions、`--dangerously-skip-permissions`、任何 `--force` 等价。

## 理由
同一合同让 Side Panel 不用分叉。薄表把差异关在 Host 内，避免「一个协议接万物」。深路径选择保住 ADR-006 安静第一屏。只列已接线 Host，避免 README 超前承诺。

## 替代方案
- 空壳占位 / 通用 argv：拒绝（范围膨胀，必滑向任意 Agent）。
- 第二套 Side Panel 协议：拒绝（双 UI、双回归）。
- webhook / localhost 入站框架：拒绝（新故障面，且偏离 Native Messaging）。
- 第一屏模型墙或「任意本机 Agent」：拒绝（破坏书桌主交付与只读合同）。
- 本波同时接 Grok / DeepSeek / Codex：拒绝（∉ W6 DoD；属 §8）。
- 只改文档、永不接 Claude：拒绝（身份表已过审；本 ADR 先落文档，实现另 PR）。

## 影响
- `plan.md` 用 `plan-w6-delta.md` 收口：允许同合同多 Host；默认 Cursor；W5 listing 仍暂停；增加 Wave 6。
- `preferences.md` 用 `preferences-w6-delta.md` 收口：设置深路径选择器；无第一屏模型墙；不写任意 Agent。
- 修订 ADR-002「只对接 Cursor」在 W6 范围内的效力；薄聊天层、不嵌开源套壳仍有效。
- 修订 ADR-005「不落盘 `cli`」：允许落盘上游 id `hostUpstream`，仍不落盘模型列表。
- 实现触达：`host/host.js`、`install-host.sh`、设置深路径、可选 README 一句。本 PR 不改这些文件。
