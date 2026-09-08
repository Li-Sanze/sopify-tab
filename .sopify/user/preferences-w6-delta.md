# preferences W6 增量

本文收口 `preferences.md` 里与上游选择冲突的旧句。本 PR 对 `preferences.md` 只做轻改；细则以本文 + `wave-6-brief.md` 为准。

## 改掉

| 旧句 | W6 |
| --- | --- |
| 「本方案只接通 `cursor-agent` 的 ask 模式……不做多 CLI 选择器，不检测 Claude / Codex。」 | 默认仍接通 Cursor ask，只读，cwd 锁定。W6 起：设置**深路径**可选已接线上游（`cursor` \| `claude`，默认 `cursor`）。Claude Code CLI 只读，身份表已过审。不检测、不展示未接线 Host。 |

## 新偏好（须同时成立）

- 上游选择只在设置深路径，不在书桌第一屏、不在左栏、不在问候旁。**无第一屏模型墙。**
- 不写、不做「任意本机 Agent」。选择器只列薄配置表里已接线的 id。
- 扩展不存 API key。鉴权走本机已有登录或进程环境 `ANTHROPIC_API_KEY`。
- Claude 只读：allow 仅 `Read`；禁止 `Edit` / `Write` / `Bash`、`acceptEdits`、`bypassPermissions`、`--dangerously-skip-permissions`、任何 `--force` 等价。
- 默认不连、第一屏不提 Host 仍有效。没装 Claude 与没装 Cursor 一样：设置页说明，不破坏书桌。
- README / 设置文案只列已接线 Host。未接线名称（含 Codex / Grok / DeepSeek）不进产品句。
- W5 listing 仍暂停；本增量不改商店主卖点（仍是安静书桌）。
