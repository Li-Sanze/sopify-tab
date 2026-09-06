# 用户长期偏好

- Sopify 是本地品牌。仓库和品牌用 Sopify Tab / `sopify-tab`，不用 SopifyT、Worktab、Startnook。
- 产品是个人也能用、也可以上架的 Chrome 新标签页工作台。
- 商店主交付是桌面：装完即可用。聊天是可选项，要另装 Host 且本机有 Cursor CLI。
- 默认不连、第一屏不提 Host。问候旁和左栏不出现「未检测到」。对话入口要到能发送时才出现。
- `prototype/index.html` 是视觉参考，不是合同。真对话在 Side Panel，不放进新标签页 DOM。
- 聊天自研薄层，不引入开源聊天产品，不嵌 Multica。
- 本方案只接通 `cursor-agent` 的 ask 模式，只读，cwd 锁定。不做多 CLI 选择器，不检测 Claude / Codex。
- 用户写下的书桌数据只进 `chrome.storage.local`。当前窗口标签不落盘。对话不落盘。
- 第一版不做微信读书、天气、音乐、番茄钟、收藏夹、富文本便签、标签跳转或去重。
- 随身听（Agent Pocket）是独立桌面产品，不进书桌、左栏或常用站；newtab 不出现 Prompt / Skill 字样。
