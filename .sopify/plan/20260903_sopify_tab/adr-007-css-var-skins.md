# ADR-007: 换肤仅 CSS 变量一层 + 启动早写防闪

## 状态
已采纳（小组 2026-09-07 审计通过；落仓文档 PR 须勾钉死项）

## 上下文
原方案「仅跟系统日夜 + 现有 CSS 天空/玻璃」，并把「手动日夜切换」列为非目标。对标审计后 Sanze 允许换肤，但小组红线仍在：不做主题商店、壁纸/视频底、用户自定义 CSS、WebGL 天空。现有 `sky.js` 只写 `data-sky` / `color-scheme` 跟随 `prefers-color-scheme`。

## 决策
1. **换肤 = 内置预设**（本波仅：跟随系统 / 昼 / 夜；`soft`∉W4 DoD）。全部通过 CSS 变量与 `data-theme`（或复用/扩展 `data-sky`）切换，不引入图片壁纸资源包。
2. **启动防闪**：在首屏 paint 前同步写根节点属性（内联极短脚本或将 `sky.js` 提到 `<head>` 最前并阻塞读取 `storage.local` 的最小键）；禁止先闪系统默认再跳预设。
3. **落盘**：预设 id 写入 `chrome.storage.local`（如 `themePreset`）；默认值 `system`。不进 `sync`。
4. **入口**：设置页增加「外观」一块；**书桌第一屏不放主题商店入口、不放预览墙**。即时预览 = 切预设即生效，不是缩略图墙。
5. **共用**：`newtab` 与 Side Panel 必须共用同一套 CSS 变量表（设置亮、侧栏暗 = 不过）。
6. **权限**：零新权限；无 `chrome.proxy`、无远程主题拉取。

## 理由
满足「可换肤」而不破坏安静书桌主交付；CSS 变量成本最低、可回滚；早写防闪是对标里唯一必须跟做的体验债。

## 替代方案
- 主题商店 / 用户贴 CSS：拒绝（范围膨胀、安全与审核风险）。
- 壁纸/视频/WebGL 天空：拒绝（与 ADR-006 安静第一屏、W1.5 禁 WebGL 冲突）。
- NTP 内嵌右栏聊天当「主题配套」：拒绝（另需 Sanze 明示；本 ADR 不覆盖）。
- 仅文档承诺、本波不实现：拒绝（Sanze 已拍可做，应最小落地）。

## 影响
- `plan.md` / `tasks.md` 增加 Wave 4；原 Wave 4 listing 顺延为 Wave 5。
- `preferences.md` 删除「禁止手动日夜」类表述，改为「允许内置预设换肤，禁止商店与自定义 CSS」。
- 实现触达：`extension/sky.js`、`newtab.html` head 顺序、`newtab.css` 变量表、设置页、可选 `sidepanel.css` 共用变量。
