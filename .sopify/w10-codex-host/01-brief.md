# W10 简报：Codex Host

对照锚：ADR-008（多 Host 薄适配）、W6 `wave-6-brief.md` / `tasks-w6.md`（`UPSTREAMS` 现仅 `cursor` \| `claude`；§8.1 Codex 原标「身份表未立」）。本文档随文档 PR 落仓。实现另开 PR，且 **HARD PRE** 未满足前不得开。本文件不代替代码，不发明身份表值。

Sanze 拍板 2026-09-10（Asia/Shanghai）。W9 与 W10 **分波、分 PR**。

## 锚（ADR-008 / W6）

W10 是 W6 薄表的**下一行**，不是新协议、不是 W6 回炉。

- 同一 Side Panel 消息合同：`detect` / `ping` / `ask` / `stop` / `shutdown`；回包仍是 `pong` / `ask_start` / `ask_delta` / `ask_done` / `stopped` / `error`。`ask` 可带可选 `upstream`。
- 薄配置表 + **每条已接线上游**一套 spawn/parser。未接线行不存在。
- 默认上游仍是 Cursor。Cursor 回归失败 = 本波失败。Claude 只读路径亦不得回归失败。
- 选择器只在设置深路径（`storage.local.hostUpstream`）。第一屏、左栏、问候旁不放上游或模型墙。
- 同时只跑一个 Host。禁止空壳 / 第二协议 / webhook / 「任意本机 Agent」。
- README 只列**已接线** Host。未接线名称不进产品文案。
- 不得覆盖本机已有 `com.openai.codexextension` 清单。
- Grok / DeepSeek 仍属后续 Host，∉ W10 DoD。

W6 已钉死 Claude 身份表；W10 **不得改写** Claude argv。Codex 身份表见下节桩，**待填**。

## HARD PRE：Codex 身份表（桩）

实现 PR 的前置条件。`id` 已锁。其余字段本 PR **保持待填**，禁止猜测填入。

| 项 | 值 |
| --- | --- |
| id | `codex`（已锁） |
| bin | 待填 |
| auth | 待填 |
| argv | 待填 |
| allow | 待填 |
| forbid | 待填 |
| stdout | 待填 |
| cwd | 待填 |
| evidence | 待填 |

HARD PRE 过闸 = 上表待填齐、有 evidence、同一审序各一句「过」。未过 = 不得改 `host/**` / 设置上游 id。

## 非目标

- 不与 W9 同 PR；不改 `extension/` 天空/玻璃/模块
- 不接 Grok / DeepSeek；不预埋第四行空壳
- webhook / 入站回调 / 第二套 Side Panel 协议
- 「任意本机 Agent」或自由填命令行
- 第一屏模型墙 / 多模型列表
- 可写执行：`Edit` / `Write` / `Bash` 进 allow、`acceptEdits`、`bypassPermissions`、`--dangerously-skip-permissions`、任何 `--force` 等价（除非身份表钉死并过审另说；本 PR 不预设允许）
- 覆盖 `com.openai.codexextension` / `com.qoder.work.connector`
- W5 listing / 商店上架
- 本 PR 填写身份表待填项
- 改 Wave 3 只读合同、改默认不连 / 第一屏不提 Host（ADR-006）

## README 诚实口径

docs／实现 PR **可**做 README 诚实收口（路线图点 W9／W10、已接线才写、至多一句观感）；**禁**扩卖点／墙／未接线 CLI；不重写叙事。

- 本 PR：**可不改** README。若改，只允许路线图写「W9／W10 已有文档、实现另开」；不得把 Codex 写成已接线。
- 实现 PR：仅当 `codex` **已接线**后，功能列表可加一行已接线 Host。不得写成「多 CLI 已全量交付」或「任意 Agent」。
- 未接线名称（Grok / DeepSeek 等）不进产品句。

## 文档 PR 清单（本 PR）

- [x] `.sopify/w10-codex-host/00-mission.md` 落仓
- [x] `.sopify/w10-codex-host/01-brief.md` 落仓
- [x] 身份表 `id=codex` 已锁；bin / auth / argv / allow / forbid / stdout / cwd / evidence = 待填
- [x] 无 `extension/**`、`host/**` 功能改动
- [x] 与 W9 目录无交叉文件
- [x] 未把 Codex 写成已接线；未编造 argv
- [ ] 审序：工程 → UI → 产品 → 技术总监；各一句「过/改」（合入后勾）

## 实现 PR 清单（HARD PRE 之后；本 PR 不改）

- [ ] 身份表待填已齐并过审
- [ ] `UPSTREAMS` 第三行仅 `codex`；无第四行空壳
- [ ] `hostUpstream`：`cursor` \| `claude` \| `codex`，默认 `cursor`，不进 `sync`
- [ ] Cursor 回归（W3 ask；不传 `--force`；关栏杀进程树）
- [ ] Claude 回归（W6 身份表 argv 一字不差）
- [ ] Codex spawn / parser 与钉死身份表一致；stdout 映射既有 `ask_delta`
- [ ] 选择器只在设置深路径；第一屏无模型墙
- [ ] 同时只跑一个 Host
- [ ] 探测失败不伤书桌；扩展不存 key
- [ ] install 不覆盖已有 Codex / Qoder host 清单
- [ ] README 只列已接线 Host；无卖点墙、无未接线 CLI
- [ ] 与 W9 实现无文件交叉

## 验收（分层）

| 层 | 内容 |
| --- | --- |
| 文档 PR | 范围锁定；HARD PRE 桩表完整；无编造值；无 Host/扩展实现 |
| HARD PRE | 身份表待填齐 + evidence + 审序过 |
| 实现 PR | 上表实现清单；Cursor / Claude 回归；只读合同未破 |

审序（任一 PR 后）：工程 → UI → 产品 → 技术总监；各一句「过/改」。

## 执行顺序

1. **文档 PR（本 PR）**：`.sopify/w10-codex-host/` 落仓。身份表保持待填。无 `extension/**`、`host/**`。
2. **HARD PRE**：另审钉死身份表。
3. **实现 PR（后开）**：仅接线 `codex`。
4. **Sanze** unpacked 点验后合实现 PR；**Rick** 翻 `wave-board.md`。

不得跳步。实现 PR 等文档合入 **且** HARD PRE 过闸。

## 实现触达（实现 PR，本 PR 不改）

- `host/host.js`：`UPSTREAMS` 增 `codex` 行；`normalizeUpstream`；Cursor / Claude 分支保持
- `host/install-host.sh`：可选快照 Codex 绝对路径（不覆盖已有 Codex / Qoder 清单）
- 设置页深路径上游 id（仅已接线）
- Side Panel 仍走既有 `ask` / `ask_delta`
- W6 / W3 回归测试；Codex 身份表测试（表钉死后）
- README 已接线 Host 一句（仅实现已接线后）

## 参考

- ADR-008（多 Host 薄适配）
- ADR-001（Side Panel + Native Messaging）
- ADR-002（自研薄聊天层；W6 已修订「只对接 Cursor」）
- ADR-006（默认不连，第一屏不提 Host）
- `wave-6-brief.md`、`tasks-w6.md` §8.1、`plan-w6-delta.md`、`preferences-w6-delta.md`
- `.sopify/w9-depth-glass/`（分波；无文件交叉）
