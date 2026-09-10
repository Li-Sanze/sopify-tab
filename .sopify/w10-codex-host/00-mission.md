# W10 Codex Host

基线：`sopify-tab` main 在 W7/W8 之后（#20 / #22；约 `22749a3`）。锚：ADR-008、W6 薄配置表（`UPSTREAMS` 现仅 `cursor` \| `claude`）。本文档只定范围，不代替实现。

Sanze 拍板 2026-09-10（Asia/Shanghai）：W10 在 W6 薄 `UPSTREAMS` 上**另波**扩一行 `codex`；**不是** W6 回炉，也**不是**任意 CLI。W9 与 W10 **分波、分 PR**。

**HARD PRE：** Codex 只读身份表必须先钉死再写实现。本目录身份表除 `id` 外均为 **待填**；未填不得开实现 PR。本 PR **不编造** bin / auth / argv / allow / forbid / stdout / cwd / evidence。

## 目标

同一 Side Panel 消息合同下，把本机 Host 薄表从已接线的 `cursor` / `claude` 扩到已声明的第三行 `codex`。默认上游仍是 Cursor。选择器只在设置深路径。只读。未钉死的字段不得开写。

## 非目标

- 不与 W9（纵深 + 玻璃）同 PR；不改 `extension/` 天空/玻璃
- 不接 Grok / DeepSeek；不为未接线 CLI 预埋空壳
- 不做 webhook / 第二套协议 / 「任意本机 Agent」/ 自由填命令行
- 不做第一屏模型墙；不改 ADR-006 安静第一屏
- 不改 W3 只读 ask 合同；不传 `--force` 等价；默认可写执行仍关
- 不覆盖本机已有 `com.openai.codexextension` 清单
- README：docs／实现 PR **可**做 README 诚实收口（路线图点 W9／W10、已接线才写、至多一句观感）；**禁**扩卖点／墙／未接线 CLI；不重写叙事。实现未合前不得把 Codex 写成已接线。
- W5 listing 仍暂停
- 本 PR 不填身份表待填项

## HARD PRE：Codex 身份表（桩）

`id` 已锁 `codex`。其余字段 **待填**；填表属后续审，不在本 PR 发明值。

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

未填齐并过审 = 不得开实现。

## 技术边界

1. 只扩 Host 薄表 + 设置深路径已接线 id；Side Panel 消息类型不新开（ADR-008）
2. 同时只跑一个 Host；切上游先停再 spawn
3. Cursor / Claude 回归失败 = 本波失败
4. 零新权限；扩展不存 API key
5. 实现触达（实现 PR，本 PR 不改；且须 HARD PRE 已满足）：`host/` `UPSTREAMS`、install 快照策略、设置深路径、W6 回归测试；不借机改 W9 视觉

## 合闸

1. **文档 PR**：本目录 `00-mission.md` + `01-brief.md` 落仓（身份表保持待填）→ 审序过闸
2. **身份表钉死**（HARD PRE；另审）：待填齐并过同一审序
3. **实现 PR**（另开）：仅在 HARD PRE 满足后接线 `codex` → 同序审；总监可合后 Rick merge

审序：工程 → UI → 产品 → 技术总监；各一句「过/改」。

## 验收

- 身份表本 PR 为桩：`id=codex` 已锁，其余待填；无编造 argv
- 与 W9 无文件交叉
- 实现波（HARD PRE 之后）：薄表第三行仅 `codex`；Cursor / Claude 回归；选择器深路径；无空壳第四行
- README 诚实口径；未接线名称不进产品句
- 无 webhook / 第二协议 / 任意 Agent / 第一屏模型墙

## 命名

`W10 Codex Host`（Host 波；独立于 W9 纵深 + 玻璃）
