# Sopify Tab

![书桌](prototype/firstscreen-v3/shots/content-filled-day.png)

打开新标签页，先看到「下一件事」，然后是这个窗口、接着上次和随手记。

<img src="prototype/shots/day.png" alt="白天" width="48%"> <img src="prototype/shots/night.png" alt="夜晚" width="48%">

## 快速开始

**品牌版 Google Chrome 已不支持 `--load-extension`（官方自 137 起移除）。请用「加载已解压的扩展程序」。**

```text
1. chrome://extensions → 打开「开发者模式」
2. 「加载已解压的扩展程序」→ 本仓库 extension/（内含 manifest.json，不要选仓库根）
3. 确认卡片「Sopify Tab」，ID cgkhllpelkjmfamddkjpnmchjikdcbgp
4. Ctrl/Cmd+T → 真扩展 NTP（我的工作台），不是 Google 默认页
```

**干净配置（Rick / 验收）**：空用户目录，只装这一份扩展：

```text
# 启动干净 profile（不要指望 --load-extension 在 Chrome 148 生效）
/usr/bin/google-chrome-stable --user-data-dir="$HOME/sopify-tab-clean-profile" --no-first-run
# 然后：chrome://extensions → 开发者模式 → 加载已解压 → …/extension/
```

若需要 CLI 自动加载：改用 **Chromium** 并加 `--disable-features=DisableLoadExtensionCommandLineSwitch`（见 `extension/desk-3d/README.md` / `scripts/load-extension.sh`）。

稳定 ID：`cgkhllpelkjmfamddkjpnmchjikdcbgp`。权限见「隐私」。本 PR 只开 Draft，不合并；Rick 督手测，专项独立审计，Sanze 确认后才能合。

## 书桌

- **下一件事**：第一条未完成待办，大标题。没有待办时直接写下一句。不拿标签或便签凑数。始终是第一屏 DOM，不经 3D。
- **这个窗口**：当前窗口有多少标签、哪些网页可以存下。点「保存这个窗口」才写入本机。
- **接着上次**：最近一份存下的窗口，可改名，一键「恢复这 N 个网页」。多于一份时，「全部 N 个」去设置里看。
- **随手记**：首屏直接写，自动存在本机。
- **常用站**：排在三栏下面。
- **空间视图（实验）**：设置里的开关，默认关闭。打开后才在常用站下方加载 Three.js 书桌；关掉不加载 `embed.js` / `scene.js` / `three.module.js`。文件夹是真实 `worksets`。便签是书桌那一条 `notes`。恢复走现有 `restoreWorksetById`（创建/激活标签，不关其它）。desk-3d 只经 newtab.js 注入的 `window.SopifyDesk3d` 回调碰真实数据，不自己读 `chrome.storage` / `chrome.tabs`。
- 存下的窗口最多 5 个；满了会问要不要覆盖最早的，不会悄悄丢掉。每个最多 50 个网页，超过会确认后只留前 50。关窗口不会自动存。

## 隐私

权限：`storage`、`tabs`、`sidePanel`。无账号、无云同步、无新权限。

本机 `chrome.storage.local` 现有键：常用站、待办、便签、称呼、外观、上游选择、工作目录，`worksets`，以及空间视图开关 `spaceView`（boolean，缺省关闭）。

`worksets` 形状：`[{ id, name, savedAt, tabs:[{ title, url }] }]`。不存 favicon、不存 tabId。只收 http(s) 和 localhost。只在明确保存时写入。最多 5 个工作集；每个最多 50 个网页。可删、可清空。不用 `storage.sync`。不用 sessions / history / bookmarks。

空间视图复用现有 `worksets` / `notes` / 待办，只多一个 `spaceView` 键。恢复走书桌已有 `restoreWorksetById`。

当前窗口标签现查，不自动落盘。对话不落盘。连 Host 才申请 `nativeMessaging`。出站跟本机环境（如 `HTTP_PROXY`）；扩展无代理设置。

## 可选：本机对话

设置深路径。没装 Host，书桌照常用。默认仍是 Cursor。Claude 只读、Codex 只读，都要本机已装对应 CLI。不能写盘、执行或传 `--force`。

## 非目标

天气、番茄钟、壁纸商店、任意 Agent、未接线 CLI、可写执行、云同步、Agent Pocket、组件墙、书签/历史聚类。

## 路线图

W1–W4、W6、W9–W12 已落地。商店上架（W5）暂停。

## 许可

[MIT](LICENSE) · [`.sopify/blueprint/`](.sopify/blueprint/)
