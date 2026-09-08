# plan.md W6 增量（文档合同）

本文说明 `plan.md` 应收口的变更。本 PR 对 `plan.md` 只做轻改（引用 W6、改掉「仅 Cursor / 无选择器」）。实现细节以 `wave-6-brief.md` / ADR-008 / `tasks-w6.md` 为准，不把实现写进 `plan.md` 正文。

## 必须改掉的旧句

| 旧句（W3/W4） | W6 收口 |
| --- | --- |
| 「本方案只对接 Cursor。不做三 CLI 选择器，不做模型列表，不检测 Claude / Codex。」 | 默认上游仍是 Cursor。W6 另立项：同一 Side Panel 合同下，薄配置表接线已声明上游；选择器仅设置深路径。不做第一屏模型墙，不写「任意本机 Agent」。Claude 只读见身份表。Codex / Grok / DeepSeek 不在本波。 |
| Scope「ask 流式只接通这一条」 | 默认仍接通 Cursor 这一条。W6 可按薄表再接 Claude；未接线 Host 不进表。 |
| 「不在本方案内：… CLI 选择器、… Claude / Codex 检测或问答」 | 不做：模型列表、任意 Agent、未接线 Host、webhook、空壳、第二协议。W6 范围内：同合同多 Host、设置深路径上游选择、Claude Code CLI 只读。 |
| Approach 图只画 `cursor-agent-proxy` | 实现波再改图。文档阶段注明：默认仍是该路径；选 `claude` 时 Host 按身份表 spawn，Side Panel 合同不变。 |

## 应增加

- Waves：`[ ] Wave 6：多 CLI Host（另立项）。同一合同薄适配；默认 Cursor；首扩 Claude 只读。见 ADR-008、wave-6-brief.md。`
- Wave 5 listing **仍暂停**；不挡 W6 文档合闸；本处不新开 listing 任务。
- Key Decisions：ADR-008；`hostUpstream`（`cursor` \| `claude`，默认 `cursor`，`storage.local`，不进 `sync`）；同时只跑一个 Host；README 只列已接线（实现波改）。
- 落盘表加一行：上游 id \| `chrome.storage.local`（`hostUpstream`）\| Wave 6（实现时）。
- Status / Next：W6 文档本 PR；实现另开；W5 仍暂停。

## 不改（plan 正文不得借 W6 放开）

- W3 只读 ask 合同、关栏杀进程树、不传 `--force`。
- 默认不连、第一屏不提 Host（ADR-006）。
- 商店包仍是书桌；聊天可选。
- listing / 实际上架仍属 W5，仍暂停。
- 可写执行、主题商店、NTP 内嵌聊天、扩展代理 UI、Agent Pocket。

## 实现波才动的 plan 段落（本 PR 不展开）

- Approach ASCII：第二上游画在 Host 内，不画第二套 `connectNative`。
- `design.md`「不设 `cli`」：改为允许 `hostUpstream`，仍不设 `model`。本 PR 不改 `design.md`。
