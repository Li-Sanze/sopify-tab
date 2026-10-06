# Sopify Tab

安静的 Chrome 新标签页工作台。打开先看到「下一件事」。

![首屏：下一件事、这个窗口、接着上次、随手记，下面是常用站](../prototype/firstscreen-v3/shots/content-filled-day.png)

```
![首屏：下一件事、这个窗口、接着上次、随手记，下面是常用站](prototype/firstscreen-v3/shots/content-filled-day.png)
```

## 功能细节

## 做什么

默认首屏，从上到下：

- **下一件事**：第一条未完成待办。没有时在这里写下句，不拿标签或便签凑数。
- **这个窗口**：当前窗口里的网页。关掉一组时，按你此刻看得到的数量来说；没关掉的会明说，不会当成已经关掉。真正关掉的网址可以在这一页重新打开，只记刚关掉的这一次；没关掉的、筛掉看不见的，不会进这张列表。换一条提示之后，上一次的「重新打开」就没了。不恢复滚动位置，也不另记一份历史。
- **接着上次**：最近一份存下的窗口，可以改名，也可以恢复。更多份在设置里。
- **随手记**：首屏直接写，自动存在本机。另一页同时在改时，两边全文都看得见，再由你选。存上了才说「已存在本机」；没存上会说明白，并留着你刚写的。过期的成功或冲突提示，不会把画面倒回旧的一版。
- **常用站**：排在三栏下面。没有照片墙。

**空间视图**在设置的「实验」里打开，默认关着。关着时不加载三维；打开后才出现在常用站下方。恢复只补上还没打开的网页。

## 隐私与权限

必选权限：`storage`、`tabs`。没有别的权限。

没有账号，没有云同步。数据留在本机浏览器里。当前窗口的网页只在打开时查看，不会自动存下来。

存下的窗口只在你点「保存这个窗口」时写入，只留标题和网址。最多 5 个，每个最多 50 个网页。存满时会先问要不要覆盖。关窗口不会自动存。

## 并发约定

待办、常用站、存下的窗口，在另一页同时改时，两边的这次操作都会留下，不会整表互相盖掉。改一条待办的文字只改文字，勾完成或撤销只改完成状态；另一页刚写下的那一半还在。同一条没存上的待办再提交，不会变成两条；两句一样的字仍可以各留一条。删掉之后，过期的修改或撤销不会把那一条写回来。一时读不出来时，不当成清空，可以重试；读成功之前，不会用空列表盖掉原有内容。改文字没存上时，对话框里留着这一次的草稿，可以再试；点到别的输入框时，焦点留在你点的地方。

## 测试

## 快速开始

品牌版 Google Chrome 用「加载已解压的扩展程序」。不要依赖 `--load-extension`。

1. 打开 `chrome://extensions`，打开「开发者模式」。
2. 点「加载已解压的扩展程序」，选择本仓库的 `extension/`（目录里有 `manifest.json`，不要选仓库根目录）。
3. 确认卡片名称是「Sopify Tab」。
4. 按 Ctrl/Cmd+T 打开新标签页，应先看到「下一件事」。点工具栏图标会再开一个新标签页。

稳定扩展 ID：`cgkhllpelkjmfamddkjpnmchjikdcbgp`。

## 开发者验证

需要 **Node 22 或更新**。浏览器检查用 Node 自带的全局 `WebSocket`，并需要本机 Chrome 或 Chromium。脚本会查找常见安装路径；浏览器不在那些路径上时，把可执行文件设到 `CHROME_BIN`。

```bash
# 例：export CHROME_BIN=/usr/bin/google-chrome
bash ../scripts/test-reliability.sh
```

找不到浏览器时，这条命令跳过浏览器段并退出 2，不算通过。要改成失败，设置 `SOPIFY_REQUIRE_BROWSER=1`（持续集成会设上），那时退出码是 1。

每个浏览器子进程另有一个外部计时（默认 240 秒，不依赖 GNU `timeout`）。时间到了只结束这一次的进程，并删掉这一次的配置目录。汇总里的通过 / 失败 / 跳过是段数；「真扩展跑过、跳过还是失败」另起一行，不会被段数盖住。

替身和静态检查不等于亲手点过一遍。Chrome for Testing 上，这条命令会等扩展的 service worker 出现，并检查两页同时加待办、两页同时改便签，以及关掉一个标签后再打开。品牌版 Chrome 这次启动若没有露出那个 service worker，该段记为跳过并写明原因，不把「品牌版一律不接受 --load-extension」当成结论，也不记成真扩展已通过。系统中文输入法、Mac，和三维便签运行时仍不在这条命令的保证里，不能记成通过。空间视图默认关着，这条命令不打开它。

## 卸载旧 Host

## 卸下旧的本机 Host

这一版只有书桌，不再连接本机对话，也不再打开侧栏。以前跑过安装脚本的话，扩展更新后不再调用 Host，本机上的注册文件还在。删掉下面这些即可，别的 Native Messaging 清单不要动：

- `~/.local/lib/sopify-tab/`（当时若设过 `SOPIFY_HOST_LIB`，删那个目录）
- Linux：`~/.config/google-chrome/NativeMessagingHosts/com.sopify.tab.json`。目录存在时，同样删掉 `~/.config/google-chrome-*/NativeMessagingHosts/com.sopify.tab.json` 和 `~/.config/chromium/NativeMessagingHosts/com.sopify.tab.json`
- macOS：`~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.sopify.tab.json`。目录存在时，同样删掉 Chrome Canary 和 Chromium 里的同名清单

删完后重开 Chrome。浏览器里以前存过的 `cwd` 和 `hostUpstream` 会留着，书桌不再读取它们。

## 历史

## 非目标

天气、番茄钟、壁纸商店、云同步、Agent Pocket、未接线的 CLI、可写执行、组件墙、书签或历史聚类。Chrome 网上应用店上架暂缓。

`.sopify/` 里的 Wave、Host 和侧栏方案是历史记录。当前书桌只做新标签页，权限只有 `storage` 和 `tabs`，不以那些旧方案为准。
