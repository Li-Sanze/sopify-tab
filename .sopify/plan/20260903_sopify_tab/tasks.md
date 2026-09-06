# 任务清单: Sopify Tab 工作台与可选本机 CLI

目录: `.sopify/plan/20260903_sopify_tab/`

依赖：Wave 2 依赖 Wave 1；Wave 3 依赖 Wave 2。文档任务可与对应 Wave 并行，但 finalize 前必须按 `knowledge_sync` 核对。

## 1. Wave 1 书桌

- [ ] 1.1 在 `extension/manifest.json` 写 MV3：`chrome_url_overrides.newtab`、稳定 `key`、权限仅 `storage` `tabs`。验收：unpacked 加载后新标签页是本扩展，扩展 ID 在移动目录后不变；`chrome://extensions` 看不到 `sidePanel` 或 `nativeMessaging`。
- [ ] 1.2 在 `extension/newtab.html` `extension/newtab.css` `extension/newtab.js` 做左侧栏两页：书桌、标签。视觉跟 `prototype/index.html` 的栏和卡片走；天空跟随系统。验收：无网络时两页可切；newtab 里没有设置页、没有对话按钮、没有 Host 芯片或「未检测到」；不把演示第三列做进 newtab。
- [ ] 1.3 在书桌页做时钟、问候称呼、常用站、待办、纯文本便签，读写 `chrome.storage.local` 的 `sites` `todos` `notes` `name`。验收：刷新或新开标签页后数据还在；不预填演示里的样例站点、待办、便签；问候旁只留日期和「N 项待办 · 本窗口 M 个标签」。
- [ ] 1.4 在书桌「这个窗口」和标签页用 `chrome.tabs` 读当前窗口：按域名分组、标题/网址筛选、关闭单条、关闭整组；localhost 端口只显示为标签。验收：只操作当前窗口，不读 history / bookmarks，不把标签列表写入 `storage`，没有跳转或去重入口。

## 2. Wave 2 可选 Host

- [ ] 2.1 在左侧栏增加设置页，只放两块：连接本机、工作目录。称呼仍在书桌上改。验收：工作目录默认空，写入 `storage.local` 的 `cwd`；设置页出现前书桌行为不变。
- [ ] 2.2 在设置 Host 卡写连接前文案（只读本机 Cursor CLI、需另装 Host、不是本地模型、不能写盘或跑 `--force`、如何跑 `install-host.sh`），并把 `nativeMessaging` 做成可选权限，用户点「检测 Host」后再 `permissions.request`。验收：未点连接时 `chrome://extensions` 看不到该权限；失败只留在设置页说明，不写回书桌、不出现「未检测到」芯片。
- [ ] 2.3 在 `host/install-host.sh` 与 host 包装脚本写入本机 Node 绝对路径（当前机为 nvm `v20.20.2`）和 `/Users/weixin.li/.local/bin/cursor-agent-proxy`。验收：用绝对路径能拉起，不依赖 alias；不覆盖已有 Codex / Qoder host JSON；`allowed_origins` 使用稳定扩展 ID。

## 3. Wave 3 只读问答

- [ ] 3.1 在 `extension/manifest.json` 补 `sidePanel`；写 `extension/background.js` `extension/sidepanel.html`。左侧栏底部出现「对话」，工具栏打开同一 Side Panel。验收：任意 https 页面点工具栏也能打开；newtab 第一屏仍不出现 Host 芯片。
- [ ] 3.2 在 Side Panel 与 host 之间实现 `connectNative` 流式 ask：`cursor-agent-proxy --print --output-format stream-json --mode ask`，cwd 仅来自 `storage.local`。头部只陈述「经本机 Cursor CLI，只读」。验收：不传 `--force`；未连接时只有说明，没有 CLI 选择器和模型列表。
- [ ] 3.3 实现停止 / 重试 / 新会话；关闭 Side Panel 时 disconnect 并杀掉整棵子进程树。验收：关侧栏后 `cursor-agent` 子进程不再残留（用进程树检查，不只看 port）；对话不写 `storage`。

## 4. 文档

- [ ] 4.1 按 `knowledge_sync` 核对 `project.md`、`blueprint/background.md`、`blueprint/design.md`；`blueprint/tasks.md` 做 review。不把 Wave 拆解写进长期知识。
- [ ] 4.2 在仓库写 listing / 隐私披露草稿（例如 `STORE.md`）：主卖点是安静新标签页工作台；聊天是可选能力，须披露可选 `nativeMessaging`、本机 Host/CLI、任意页同一侧栏入口。验收：「不卖 AI workflow」只表示不以聊天当主卖点，文案不得把该能力写成未提供。不执行实际上架。
