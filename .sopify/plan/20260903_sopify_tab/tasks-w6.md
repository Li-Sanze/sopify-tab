# 任务清单: Wave 6 多 CLI Host（另立项）

目录: `.sopify/plan/20260903_sopify_tab/`

依赖：W3 合同与 W4 已合入 main。W6 实现 PR 须等文档 PR 合入。W5 listing 仍暂停，与本波并行不阻塞。§8 后续 Host **不在本波**。

完整 DoD / 非目标 / Claude 身份表见 `wave-6-brief.md`、ADR-008。

## 7. Wave 6 多 CLI Host

- [ ] 7.1 文档闭环：`wave-6-brief.md` / `tasks-w6.md` / ADR-008 / `plan-w6-delta.md` / `preferences-w6-delta.md` / `wave-board.md`，以及 `plan.md` / `tasks.md` / `preferences.md` 轻改，对齐钉死项。本任务在文档 PR 合入后算完成。验收：审序工程→UI→产品→技术总监各一句「过/改」；全文无「待钉」；Claude argv 已写入 brief / 7.4；无 `extension/**`、`host/**`、无 README 功能改动。

- [ ] 7.2 Cursor 回归（实现 PR）：默认 `hostUpstream=cursor`。spawn 仍是快照 `cursor-agent-proxy --print --output-format stream-json --mode ask`；不传 `--force` / `-f` / `--yolo`；cwd 来自 `storage.local`，可空；`ask_delta` / `stop` / 关栏杀进程树与 W3 一致。`host/test-w3-ask.js`（或等价）必须仍过。验收：切到 Claude 再切回 Cursor，Cursor 路径与改前无差；不得为接 Claude 改掉 Side Panel 消息类型。

- [ ] 7.3 薄配置表（实现 PR）：Host 内一张表，本波仅两行。

  | id | 二进制 | argv | parser |
  | --- | --- | --- | --- |
  | `cursor` | install 快照 `cursorAgentProxy` | `--print --output-format stream-json --mode ask` + prompt | 既有 stream-json → `ask_delta` |
  | `claude` | PATH `claude` 或 install 快照绝对路径 | 见 7.4，不得改写 | NDJSON → 既有 `ask_delta` |

  设置深路径写入 `storage.local.hostUpstream`（仅 `cursor` \| `claude`，默认 `cursor`，不进 `sync`）。ask 可带 `upstream`，缺省按已存 id，再缺省 `cursor`。同时只跑一行。验收：表内无第三行空壳；选择器不出现在书桌第一屏；未接线 id 不进表、不进设置、不进 README。

- [ ] 7.4 Claude 只读接线（实现 PR）：Host **只**按下列 argv spawn，无「待钉」、无额外 allow、无 force 等价。

  ```
  claude --bare -p "<prompt>" \
    --permission-mode dontAsk \
    --allowedTools "Read" \
    --output-format stream-json \
    --verbose \
    --include-partial-messages
  ```

  `--bare` 跳过 hooks / MCP / `CLAUDE.md`。cwd 来自设置工作目录，可空。探测：二进制 `claude` 经 PATH 或 install 快照绝对路径（与 Cursor Host 同一策略）；`ENOENT` = 设置页诚实失败，不伤书桌。鉴权：本机已有登录或进程环境 `ANTHROPIC_API_KEY`；扩展永不存 key。流：NDJSON → 既有 `ask_delta`；`stop` / 杀进程树。禁止：allow 含 `Edit` / `Write` / `Bash`；`acceptEdits` / `bypassPermissions` / `--dangerously-skip-permissions`；任何 `--force` 等价。依据：https://code.claude.com/docs/en/headless 。验收：抓到的 argv 与上表一致；Cursor 回归（7.2）同时成立。

## 8. 后续 Host（不在本波）

下列条目**不是** W6 DoD，不得预埋空壳、第二协议或 webhook 框架。另开方案再写身份表。

- [ ] 8.1 Codex CLI（只读身份表未立，本波不做）
- [ ] 8.2 Grok CLI（∉ W6 DoD）
- [ ] 8.3 DeepSeek CLI（∉ W6 DoD）
- [ ] 8.4 其它未接线本机 CLI / 「任意 Agent」（明确不做）
