# Wave 6 Brief：多 CLI Host（另立项）

## 状态

Claude Code CLI 只读身份表已过审（工程 / 产品 / UI / 技术总监，2026-09-08）。本文档随文档 PR 落仓。实现另开 PR，本文件不代替代码。W5 listing 仍暂停。

## 目标

在**不改 Side Panel 消息合同**的前提下，把本机 Host 从「只 spawn 一条 Cursor」收成**薄配置表 + 每条已接线上游一套 spawn/parser**。默认上游仍是 Cursor。本波首扩 **Claude Code CLI 只读**。上游选择只出现在设置深路径，不抢第一屏，不写成「任意本机 Agent」。

## DoD（必须同时满足）

- Side Panel 仍只认既有消息：`detect` / `ping` / `ask` / `stop` / `shutdown`；回包仍是 `pong` / `ask_start` / `ask_delta` / `ask_done` / `stopped` / `error`。不新开第二套协议。
- 默认上游 = Cursor。现有 `cursor-agent-proxy --print --output-format stream-json --mode ask` 路径不得回归失败（不传 `--force` / `-f` / `--yolo`；cwd 来自设置，可空；关栏杀进程树）。
- Host 用薄配置表接线；**只为已声明上游写 spawn/parser**。禁止为空壳 / 未接线 CLI 预留会跑的占位实现。
- 设置深路径可选上游（`storage.local` 键 `hostUpstream`，值仅 `cursor` \| `claude`，默认 `cursor`）。第一屏、左栏、问候旁不放选择器或模型墙。
- 同时只跑一个上游（one-host-at-a-time）。切上游不并行双 spawn。
- Claude 只读身份表按下节钉死；argv 不得改写。
- Claude 探测失败（含 `ENOENT`）只在设置页诚实说明，不破坏书桌。
- 扩展不存储 API key。鉴权只走本机已有登录或进程环境 `ANTHROPIC_API_KEY`。
- 零新权限；不引入 webhook 框架。
- README **只列已接线 Host**。本 PR 不改 README；实现 PR 若改 README，不得写成「多 CLI 已全量交付」或「任意 Agent」。
- Grok / DeepSeek / Codex **不属于** W6 DoD。
- W5 listing 仍暂停，不挡本波文档合闸。

## 非目标

- webhook / 入站回调框架
- 空壳 Host、未接线 CLI 的占位 spawn
- 第二套 Side Panel / Native Messaging 协议
- 「任意本机 Agent」或自由填命令行
- 第一屏模型墙 / 多模型列表
- Grok、DeepSeek、Codex（后续 Host，见 `tasks-w6.md` §8）
- 可写执行：`Edit` / `Write` / `Bash` 进 allow、`acceptEdits`、`bypassPermissions`、`--dangerously-skip-permissions`、任何 `--force` 等价
- W5 listing / 商店上架操作
- 改 Wave 3 只读合同、改默认不连 / 第一屏不提 Host

## 钉死项（须在 brief / tasks-w6 / ADR-008 / wave-board / preferences 增量同时成立）

1. 同一 Side Panel 消息合同；薄配置表；每已接线上游一套 spawn/parser。
2. 默认仍 Cursor；Cursor 回归不过 = 本波不过。
3. 首扩上游 = Claude Code CLI，argv 按下节，无「待钉」。
4. 选择器只在设置深路径；第一屏无模型墙。
5. 同时只跑一个 Host。
6. 不做 webhook / 空壳 / 第二协议 / 任意 Agent。
7. W5 listing 仍暂停。
8. 执行顺序：文档 PR（本 PR）→ 实现 PR → Sanze 点验。本 PR **仅文档**。
9. Wave board 更新人是 **Rick**（不是 JARVIS）。

## Claude Code CLI 只读身份表（已过审，不得改写）

首扩上游 = Claude Code CLI。Host only spawns:

```
claude --bare -p "<prompt>" \
  --permission-mode dontAsk \
  --allowedTools "Read" \
  --output-format stream-json \
  --verbose \
  --include-partial-messages
```

| 项 | 钉死 |
| --- | --- |
| 二进制 | `claude`：先 PATH，再 install 快照绝对路径（与 Cursor Host 同一策略） |
| 探测失败 | `ENOENT` = 设置页诚实失败，不伤书桌 |
| `--bare` | 跳过 hooks / MCP / `CLAUDE.md` |
| cwd | 设置里的工作目录，可空 |
| 允许工具 | 仅 `Read` |
| 权限模式 | `dontAsk` |
| 禁止 | allow 里出现 `Edit` / `Write` / `Bash`；`acceptEdits` / `bypassPermissions` / `--dangerously-skip-permissions`；任何 `--force` 等价 |
| 鉴权 | 本机已有登录，或进程环境 `ANTHROPIC_API_KEY`；扩展永不存 key |
| 流 | NDJSON → 既有 `ask_delta`；`stop` / 杀进程树 |
| 回归 | Cursor 路径不得被本波改坏 |
| 依据 | https://code.claude.com/docs/en/headless |

## 范围拆分

### A（必须，实现 PR）

- Cursor 回归：默认 `hostUpstream=cursor` 时行为与 W3 合同一致；`host/test-w3-ask.js`（或等价）仍过。
- 薄配置表：`cursor` / `claude` 两行；每行绑定二进制、argv、parser。禁止第三行空壳。
- 设置深路径「上游」：仅已接线 id；默认 Cursor；不进 `sync`。
- Claude spawn 使用上表 argv；stdout NDJSON 映射到既有 `ask_delta`；关栏杀进程树。
- Claude 探测：`claude` 经 PATH 或 install 快照绝对路径；失败只留设置页。

### B（本波不做）

- §8 后续 Host（Codex / Grok / DeepSeek 等）。
- webhook、空壳、第二协议、任意 Agent、模型列表。
- listing / 上架（W5，仍暂停）。

### C（必须记要求；改 README 在实现 PR）

- README 功能列表只写已接线 Host。未接线名称不出现在产品文案里。
- **本 PR 不改 README 正文。**

## 验收（实现 PR 合入前；本 PR 不勾完成）

| 项 | 内容 | 所有者 |
| --- | --- | --- |
| V1 | 默认 Cursor；W3 ask 合同未破；不传 `--force`；关栏杀进程树。 | 工程 |
| V2 | 薄配置表仅 `cursor`/`claude`；各一套 spawn/parser；无空壳第三行。 | 工程 |
| V3 | Claude argv 与身份表一字不差；allow 仅 `Read`；无 acceptEdits / bypass / force 等价。 | 工程 |
| V4 | 选择器只在设置深路径；第一屏无模型墙、无「任意 Agent」。 | UI / 产品 |
| V5 | `ENOENT` 等探测失败不伤书桌；扩展不存 key。 | 工程 / 产品 |
| V6 | 无 webhook / 第二协议；Grok / DeepSeek ∉ DoD；W5 listing 仍暂停；README 未宣称多 CLI 已全量交付。 | 产品 / 技术总监 |

审序（任一 PR 后）：工程 → UI → 产品 → 技术总监；各一句「过/改」。

## 执行顺序

1. **文档 PR（本 PR）**：`.sopify/` 内 brief / tasks-w6 / ADR-008 / plan 轻改与 delta / preferences 轻改与 delta / wave-board 对齐钉死项。无 `extension/**`、`host/**`、无 README 功能改动。
2. **实现 PR（后开）**：A + C；B 不做。
3. **Sanze** unpacked 点验后合实现 PR；**Rick** 翻 `wave-board.md`。

不得跳步：实现 PR 等文档合入。本 PR 不合实现、不改扩展或 Host 代码。

## 依赖

- Wave 6 依赖 Wave 3 合同已在 main（PR #6），以及 Wave 4 已合（PR #11）。
- 实现依赖本 brief / ADR-008 落仓。
- Wave 5 listing 仍暂停，不挡 Wave 6 文档合闸。

## 实现触达（实现 PR，本 PR 不改）

- `host/host.js`：配置表、Claude spawn/parser；Cursor 分支保持
- `host/install-host.sh`：可选快照 `claude` 绝对路径（与 Cursor 同一策略）
- 设置页深路径上游选择；`storage.local.hostUpstream`
- Side Panel 仍走既有 `ask` / `ask_delta`；不新开消息类型
- README 已接线 Host 一句（实现 PR）

## 参考

- ADR-008（多 Host 薄适配）
- ADR-001（Side Panel + Native Messaging）
- ADR-002（自研薄聊天层；W6 修订其「只对接 Cursor」句）
- ADR-006（默认不连，第一屏不提 Host）
- `tasks-w6.md`、`plan-w6-delta.md`、`preferences-w6-delta.md`
- https://code.claude.com/docs/en/headless
