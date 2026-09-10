# W10 Codex 只读身份表（canonical）

状态：**已钉（文档）**。无待填。来源：Mac `weixin.li` 本机核验 2026-09-10 + 工程审。CLI：`codex-cli 0.153.4`。

本文件是身份表唯一 canonical。`01-brief.md` HARD PRE 节同表。本文件**不代替实现**：**不得**据此 PR 改 `host/**` / `extension/**`、不 spawn Codex。实现另开 PR，且须本表审序过闸。

W6 / ADR-008 非目标仍成立：不接 Grok / DeepSeek；无空壳第四行；无 webhook / 第二协议 / 「任意本机 Agent」；不改 Claude argv；不改 Side Panel 合同；默认可写执行仍关。

## 表

| 项 | 值 |
| --- | --- |
| id | `codex` |
| bin | 本机绝对路径优先：`/Applications/ChatGPT.app/Contents/Resources/codex`（验机 `weixin.li`，codex-cli 0.153.4）。`~/.local/bin/codex` 可能是指向该二进制的 symlink，可用。Host **不得**经 shell 展开 alias `codex→codex-proxy`。PATH 上的真实 `codex` 可作回退。`ENOENT` = 设置页诚实失败，不伤书桌。install 可选快照绝对路径（pathKey 策略同 Claude；键名实现 PR 再落）。 |
| auth | 本机已有 Codex 登录：`~/.codex/auth.json` 存在即视为已登录。扩展永不存 Key。永不上传 / 不外发 auth 文件内容。 |
| argv | `exec -s read-only --json --ephemeral --skip-git-repo-check` + 可选 `-C <cwd>` + prompt。本 CLI help **无** `--ask-for-approval`，不得传。stdin **必须关闭**。 |
| allow | 仅 `-s read-only` |
| forbid | `--dangerously-bypass-approvals-and-sandbox`；`-s workspace-write`；`-s danger-full-access`；`--dangerously-bypass-hook-trust`；任何 force / yolo / bypass 等价。用户不可开启。 |
| stdout | `--json` → JSONL。验机观察到的 type：`thread.started`、`turn.started`、`item.completed`（`item.type` = `agent_message` \| `error`）、`turn.completed`、`error`。映射到既有 `ask_delta` 属实现 PR，本文件不写 parser。 |
| cwd | `-C` / `--cd` |
| stop | SIGTERM 进程树；优先 `--ephemeral`（不持久化 session） |
| evidence | https://developers.openai.com/codex/cli/reference ；本机 `codex exec --help`（`weixin.li`，2026-09-10） |

## argv 形

```
<codex-bin> exec -s read-only --json --ephemeral --skip-git-repo-check \
  [-C <cwd>] \
  "<prompt>"
```

- `<codex-bin>` 按上表 bin 解析，禁止 alias `codex→codex-proxy`。
- 无 `--ask-for-approval`（该旗不在本 CLI `codex exec --help`）。
- stdin 必须关闭（非交互；不得把 prompt 挂在未关的 stdin 上）。
- cwd 可空：无工作目录时省略 `-C` / `--cd`。
- 上表 argv **不得改写**；改写须另审，不得在实现 PR 私改。

## 非实现

本 PR 只钉表。Host spawn、JSONL → `ask_delta`、install 快照键名、设置深路径第三行，一律实现 PR。本目录合入 ≠ 已接线。

## 依据

- https://developers.openai.com/codex/cli/reference
- 本机 `codex exec --help`（Mac `weixin.li`，2026-09-10，codex-cli 0.153.4）
- ADR-008；W6 `wave-6-brief.md` / `tasks-w6.md` §8.1（W6 非目标：当时身份表未立；本表补钉，仍不是 W6 回炉）
