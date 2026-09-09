# W8 简报

对照 SoT：`prototype/index.html`（布局 / 玻璃 / 悬停）+ ADR-006（对话入口）。本波要书桌先、字少、不挡用。实现锁在五项 DoD；本文件不代替代码。

## DoD（五项必须同时满足）

1. **间距**  
   `.deskgrid` / `.settings` / `.groups` 的 gap：14px → **18px**。  
   `.deskhead` 对齐原型：`margin-bottom: 26px`；`gap: 18px 24px`（现为 24 / 16×22）。窄屏列堆叠可仍用更小 gap，不挡主档。

2. **玻璃与阴影**  
   只改 `theme.css` 日夜表里的 `--glass` / `--glass-hi` / `--shadow-*`，量级对齐原型。  
   NTP 与 Side Panel **共用同一张表**，禁止在 `sidepanel.css` 另写一套。  
   **禁止**改 W7 天空透视、DOM、SVG 层。  
   实现时若 `host/test-sky-layers.js` 仍钉旧透明度，随 token 改断言，不得借机改天空。

3. **卡片悬停**  
   `.card.group:hover` 去掉 `translateY`，只抬到 `--shadow-2`（与原型一致）。  
   `prefers-reduced-motion` 下无位移、无多余过渡。磁贴 `.tile:hover` 的 `translateY` 不在本项，勿顺手扩范围。

4. **文案收口**  
   设置页与 Side Panel：每条 help / note / viewhead / guard / empty / hint **≤ 一句或一枚 chip**。  
   事实保留（只读、另装 Host、不是本地模型、不写不执行、书桌不依赖 Host）。  
   允许改 `sidepanel.html` 静态文案；不新写说明墙。

5. **对话入口**  
   左栏「对话」`#open-chat` 仅在 Host 能发送时显示或强调（`hostConnected()` / ADR-006）。  
   未连时不占第一屏注意力。零新权限、零新存储。不把聊天 DOM 放回 newtab。

## 可选（默认不做）

磁贴删除热区 ≥ 32px（现 `.tile-remove` 为 24px）。**仅当 1–5 仍然轻量时才做**；不得挡住五项合闸。

## 非目标

- 不做 WebGL / Canvas
- 不新开模块、不做小组件墙
- 不改 Host / W6 上游
- 不回滚 #20 天空
- 除非用户可见事实必须补一句，不重写 README
- 不把聊天 DOM 放回 newtab

## 基线证据（main `57bf3b3` vs `prototype/`）

| 点 | main | 原型 / 合同 |
| --- | --- | --- |
| desk / settings / groups gap | 14px | 18px |
| deskhead | margin 24px；gap 16×22 | margin 26px；gap 18×24 |
| 日 `--glass` / `--glass-hi` | `0.9` / `0.44` | `0.86` / `0.95` |
| 夜 `--glass` | `rgba(18, 26, 40, 0.8)` | `rgba(22, 31, 48, 0.66)` |
| `--shadow-*` | 偏轻（夜 shadow-2 约 40/−18 / 0.55） | 原型量级（日更开；夜更深，约 70/−20 / 0.7） |
| `.card.group:hover` | `translateY(-1px)` | 只抬 `shadow-2` |
| `#open-chat` | 始终可见 | ADR-006：能发送才出现 / 强调 |

日夜 `--glass-edge` 与天空 token **不是**本波必改项。`--shadow-*` 以原型完整声明为准，不要只改透明度数字。

## 实现触达（实现 PR，本 PR 不改）

- `extension/newtab.css`：gap、deskhead、`.card.group:hover`
- `extension/theme.css`：玻璃 / 阴影 token（天空层不动）
- `extension/newtab.html` / `newtab.js`：设置文案、`#open-chat` 显隐或强调
- `extension/sidepanel.html` / `sidepanel.js`：hint / empty / guard 收口
- `host/test-sky-layers.js`：若断言钉旧 `--glass`，随 token 改（不改天空用例）
- README：仅当用户可见事实必须补一句

## 执行顺序

1. 文档 PR（本 PR）→ 小组审序合入
2. 实现 PR（后开）：五项 DoD；可选热区默认不做
3. Sanze unpacked 点验；Rick 翻 wave-board

审序：工程 → UI → 产品 → 技术总监；各一句「过/改」。
