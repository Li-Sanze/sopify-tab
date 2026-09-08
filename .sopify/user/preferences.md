# 用户长期偏好

- Sopify 是本地品牌。仓库和品牌用 Sopify Tab / `sopify-tab`，不用 SopifyT、Worktab、Startnook。
- 产品是个人也能用、也可以上架的 Chrome 新标签页工作台。
- 商店主交付是桌面：装完即可用。聊天是可选项，要另装 Host 且本机有已接线上游（默认 Cursor CLI）。
- 默认不连、第一屏不提 Host。问候旁和左栏不出现「未检测到」。对话入口要到能发送时才出现。
- `prototype/index.html` 是视觉参考，不是合同。真对话在 Side Panel，不放进新标签页 DOM。
- 聊天自研薄层，不引入开源聊天产品，不嵌 Multica。
- 默认接通 Cursor ask，只读，cwd 锁定。W6 另立项：设置深路径可选已接线上游（`cursor` \| `claude`，默认 `cursor`）；Claude Code CLI 只读（身份表见 `preferences-w6-delta.md`）。第一屏不做模型墙。不写「任意本机 Agent」。未接线 Host（Codex / Grok / DeepSeek 等）不进本波。
- 上游选择只在设置深路径；扩展不存 API key。鉴权走本机已有登录或进程环境 `ANTHROPIC_API_KEY`。
- 用户写下的书桌数据只进 `chrome.storage.local`。当前窗口标签不落盘。对话不落盘。
- 第一版不做微信读书、天气、音乐、番茄钟、收藏夹、富文本便签、标签跳转或去重。
- 随身听（Agent Pocket）是独立桌面产品，不进书桌、左栏或常用站；newtab 不出现 Prompt / Skill 字样。
- 允许在设置页用内置外观预设 `system` / `day` / `night` 换肤；只走 CSS 变量。禁止主题商店、壁纸/视频底、用户自定义 CSS、WebGL 天空。`soft` 不是 W4 交付。
- 换肤不得破坏「默认不连、第一屏不提 Host」。换肤入口不放书桌第一屏；即时预览是切预设即生效，不是预览墙。
- 扩展不提供代理配置。网络问题归本机 Host 或环境，不在扩展里做代理 UI。
