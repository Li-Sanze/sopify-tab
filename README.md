# Sopify Tab

`sopify-tab`：安静的 Chrome 新标签页工作台。打开先看到「下一件事」。

![首屏：下一件事、这个窗口、接着上次、随手记、常用站](prototype/firstscreen-v3/shots/content-filled-day.png)

## 做什么

默认首屏，从上到下：

- **下一件事**：第一条未完成待办。没有待办时直接写下一句，不用标签或便签凑数。
- **这个窗口**：当前窗口里有哪些网页。
- **接着上次**：最近一份存下的窗口，可改名，一键恢复。多于一份时，去设置里看全部。
- **随手记**：首屏直接写，自动存在本机。
- **常用站**：排在三栏下面。没有照片墙。

**空间视图（实验）**在设置里打开，默认关闭。关闭时不加载三维场景；打开后才出现在常用站下方。

## 快速开始

品牌版 Google Chrome 用「加载已解压的扩展程序」。`--load-extension` 在品牌版上不可靠，不要依赖它。

1. 打开 `chrome://extensions`，打开「开发者模式」。
2. 「加载已解压的扩展程序」，选择本仓库的 `extension/`（里面有 `manifest.json`，不要选仓库根目录）。
3. 确认卡片名称是「Sopify Tab」。
4. Ctrl/Cmd+T 打开新标签页，应先看到「下一件事」，而不是 Google 默认页。

验收可以用空的用户目录，只装这一份扩展，仍走上面的「加载已解压」。需要命令行加载时改用 Chromium，见 [`scripts/load-extension.sh`](scripts/load-extension.sh)。

稳定扩展 ID：`cgkhllpelkjmfamddkjpnmchjikdcbgp`。

## 隐私与权限

必选权限：`storage`、`tabs`、`sidePanel`。没有额外的强制权限。`nativeMessaging` 只在连接可选的本机 Host 时申请。

没有账号，没有云同步。数据在本机 `chrome.storage.local`。当前窗口的标签只在打开时查看，不会自动落盘。对话内容不落盘。

存下的窗口只在你明确点「保存这个窗口」时写入。最多 5 份，每份最多 50 个网页。存满或超出时会先确认，不会悄悄丢掉。关掉窗口不会自动保存。

## 可选：本机对话

在「设置 → 高级 → 连接本机」。没装 Host，书桌照常使用。默认上游是 Cursor，只读。Claude 与 Codex 同样只读，且本机需已安装对应 CLI。不能写盘、执行，也不能传 `--force`。需要时再装 Host，见 [`host/install-host.sh`](host/install-host.sh)。

## 非目标

天气、番茄钟、壁纸商店、云同步、Agent Pocket、未接线的 CLI、可写执行、任意 Agent、组件墙、书签或历史聚类。Chrome 网上应用店上架暂缓。

## 许可

[MIT](LICENSE) · [`.sopify/blueprint/`](.sopify/blueprint/)
