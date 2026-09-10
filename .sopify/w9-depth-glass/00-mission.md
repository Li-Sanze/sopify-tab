# W9 纵深 + 玻璃（depth + glass）

基线：`sopify-tab` main 在 W7/W8 之后（#20 / #22；约 `22749a3`）。SoT：moodboard MB-① 日 / MB-③ 纵深（主）；MB-② 夜仅 vibe。本文档只定范围，不代替实现。

Sanze 拍板 2026-09-10（Asia/Shanghai）：**零新模块**；只加深 CSS `perspective` 纵深与玻璃/间距，朝 moodboard SoT 收束；**不是** moodboard widget 墙。W9 与 W10 **分波、分 PR**。

## 目标

在既有书桌骨架上，把日/夜静帧的**雾/几何纵深**与**磨砂玻璃层级**再贴近 SoT；desk-first、少文字；默认模块集合不变，只更安静、更深。

## 非目标

- **零**新模块；CUT：搜索、天气、专注计时、长导航、名言卡、component wall
- 不做 moodboard 整墙复刻；书桌骨架仍 = 侧栏 + 既有 3/4 主模块，对齐 `prototype/`
- 不引入 WebGL / Canvas / 粒子
- 不改 Host / 设置深路径合同；不动上游表
- README：docs／实现 PR **可**做 README 诚实收口（路线图点 W9／W10、已接线才写、至多一句观感）；**禁**扩卖点／墙／未接线 CLI；不重写叙事。
- 不与 W10（Codex Host）同 PR

## UI SoT

| 板 | 角色 | 要点 |
| --- | --- | --- |
| MB-① 日 | 主 | 软天空 + 磨砂玻璃层级 |
| MB-③ 纵深 | 主 | 雾 / 几何纵深，经 CSS `perspective` |
| MB-② 夜 | vibe 仅 | 深靛蓝 + 软光晕；抽象光带/雾；**禁**写实楼宇 / 海报式行星环 |

## 技术边界

1. 只动 `extension/`（天空/主题 token、玻璃与间距相关）
2. CSS `perspective` + 既有层语言深化；无新渲染栈
3. 日/夜仍帧对照 SoT；`prefers-reduced-motion` → Still 仍可读好看
4. 默认模块集 = 现网，不得借「视觉」塞控件

## 合闸

1. **文档 PR**：本目录 `00-mission.md` + `01-visual-brief.md` 落仓 → 审序过闸
2. **实现 PR**（另开）：仅视觉深化 → 同序审；总监可合后 Rick merge

审序：工程 → UI → 产品 → 技术总监；各一句「过/改」。

## 验收

- 日/夜静帧 vs SoT：纵深与玻璃层级可读；无写实楼宇/行星环
- desk-first、少文字；默认模块集合与现网一致，观感更安静/更深
- 无新权限 / widget；Host / README 诚实口径
- 与 W10 无文件交叉

## 命名

`W9 纵深 + 玻璃`（视觉波；独立于 W10 Codex Host）
