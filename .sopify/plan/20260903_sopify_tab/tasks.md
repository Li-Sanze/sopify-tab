# 任务清单: Sopify Tab 工作台与可选本机 CLI

目录: `.sopify/plan/20260903_sopify_tab/`

依赖：Wave 2 依赖 Wave 1；Wave 3 依赖 Wave 2。文档任务可与对应 Wave 并行，但 finalize 前必须按 `knowledge_sync` 核对。

## 1. Wave 1 书桌

- [ ] 1.1 在 `extension/manifest.json` 写 MV3：`chrome_url_overrides.newtab`、稳定 `key`、权限仅 `storage` `tabs` `sidePanel`。验收：unpacked 加载后新标签页是本扩展，扩展 ID 在移动目录后不变。
- [ ] 1.2 在 `extension/newtab.html` `extension/newtab.css` `extension/newtab.js` 做书桌：时钟、手填常用站、极简待办、纯文本便签。验收：无网络、无 Host 时四块可读写 `chrome.storage.local`。
- [ ] 1.3 在同一套 newtab 脚本里做当前窗口标签网格：按域名分组，跳转 / 关闭 / 去重；localhost 端口只显示为标签。验收：只操作当前窗口，不读 history / bookmarks。
- [ ] 1.4 在 `extension/background.js` 把工具栏图标和书桌 FAB 都指向同一 Side Panel。验收：任意 https 页面点工具栏也能打开侧栏；此时侧栏可以仍是空态。

## 2. Wave 2 可选 Host

- [ ] 2.1 在 `extension/sidepanel.html` 做空态：说明聊天可选、如何跑 `install-host.sh`、无 Host 时书桌不受影响。验收：未授权 `nativeMessaging` 时侧栏只有说明，无连接错误炸掉书桌。
- [ ] 2.2 在 `extension/manifest.json` 把 `nativeMessaging` 做成可选权限，用户点「连接本机 CLI」后再 `permissions.request`。验收：刚安装时 `chrome://extensions` 看不到该权限已授予。
- [ ] 2.3 在 `host/install-host.sh` 与 host 包装脚本写入本机 Node 绝对路径（当前机为 nvm `v20.20.2`）和 `/Users/weixin.li/.local/bin/cursor-agent-proxy`。验收：用绝对路径能拉起，不依赖 alias；不覆盖已有 Codex / Qoder host JSON；`allowed_origins` 使用稳定扩展 ID。

## 3. Wave 3 只读问答

- [ ] 3.1 在 Side Panel 与 host 之间实现 `connectNative` 流式 ask：`cursor-agent-proxy --print --output-format stream-json --mode ask`，cwd 仅来自设置。验收：不传 `--force`；Host / CLI 缺失时只显示可复制说明。
- [ ] 3.2 实现停止 / 重试 / 新会话；关闭 Side Panel 时 disconnect 并杀掉整棵子进程树。验收：关侧栏后 `cursor-agent` 子进程不再残留（用进程树检查，不只看 port）。

## 4. 文档

- [ ] 4.1 按 `knowledge_sync` 核对 `project.md`、`blueprint/background.md`、`blueprint/design.md`；`blueprint/tasks.md` 做 review。不把 Wave 拆解写进长期知识。
