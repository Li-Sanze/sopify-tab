# Sopify Tab

`sopify-tab`：安静的 Chrome 新标签页工作台。打开先看到「下一件事」。

![首屏：下一件事、这个窗口、接着上次、随手记、常用站](prototype/firstscreen-v3/shots/content-filled-day.png)

## 做什么

默认首屏，从上到下：

- **下一件事**：第一条未完成待办。没有待办时直接写下一句，不拿标签或便签凑数。
- **这个窗口**：当前窗口里有哪些网页。
- **接着上次**：最近一份存下的窗口，可改名，一键恢复。多于一份时，去设置里看全部。
- **随手记**：首屏直接写，自动存在本机。内容仍是一条字符串 `notes`。`notesRev`（数字）和 `notesStamp`（字符串）只用来发现另一页已经改过；旧数据没有这两项时照常打开，下一次成功保存才会写上。没写上时旁边会写「没存上」，不会先说「已存在本机」。
- **常用站**：排在三栏下面。没有照片墙。

**空间视图（实验）**在设置里打开，默认关闭。关闭时不加载 Three；打开后才出现在常用站下方。恢复走 `restoreWorksetById`。

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

没有账号，没有云同步。数据在本机 `chrome.storage.local`。当前窗口的标签只在打开时查看，不会自动落盘。对话内容不落盘。扩展无代理设置，也不读取 `HTTP_PROXY` 或 `HTTPS_PROXY`。

存下的窗口只在你明确点「保存这个窗口」时写入 `worksets`（只要 title, url，不存 favicon）。最多 5 份，每份最多 50 个网页。存满时会先问要不要覆盖，不会悄悄丢掉。关窗口不会自动存。

## 可选：本机对话

在「设置 → 高级 → 连接本机」。没装 Host，书桌照常使用。默认上游是 Cursor，只读。Claude 与 Codex 同样只读，且本机需已安装对应 CLI。不能写盘、执行，也不能传 `--force`。需要时再装 Host，见 [`host/install-host.sh`](host/install-host.sh)。

## 可靠性

```bash
bash scripts/test-reliability.sh
```

先跑静态和多页便签单测（`node host/test-r1-r7.js`、w11、w12、w4、天空层、伴随模块已移除、三维书桌门禁、`host/test-w13-firstscreen.js`），再跑浏览器行为（`node host/test-r1-r7-browser.js`）。脚本会逐项打印 pass / fail / skip。退出码：`0` 每一项都过了；`1` 有断言失败，或浏览器检查因为缺少全局 `WebSocket` 跑不起来；`2` 只在找不到 Chrome / Chromium 时出现。退出码 `2` 是跳过，不是通过。不会因为少跑某项而变成 `0`。

浏览器检查需要带全局 `WebSocket` 的 Node（Node 22 及以上）。`CHROME_BIN` 指向 Chrome 或 Chromium，Linux 和 macOS 路径都可以。`SOPIFY_CDP_PORT` 指定调试端口；不设就挑一个空闲端口。`SOPIFY_ARTIFACT_DIR` 指定截图目录；写不进去时改用临时目录，截图失败本身不会把整组测试判失败。临时用户目录在结束时删掉。

浏览器脚本里的存储是桩，用来看界面和失败态，不是已经加载的扩展。真扩展按上面的「加载已解压」安装。品牌版 Chrome 148 会忽略命令行 `--load-extension`。这些测试不调用本机 Host，也不改 Host 的安装。

## 非目标

天气、番茄钟、壁纸商店、云同步、Agent Pocket、未接线的 CLI、可写执行、组件墙、书签或历史聚类。Chrome 网上应用店上架暂缓。

## 许可

[MIT](LICENSE) · [`.sopify/blueprint/`](.sopify/blueprint/)
