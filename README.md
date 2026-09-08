# Sopify Tab

安静的 Chrome 新标签页书桌——装完即用，值得当默认页；本机 Cursor 问答可选。

![书桌](prototype/shots/desk.png)

<img src="prototype/shots/day.png" alt="白天" width="48%"> <img src="prototype/shots/night.png" alt="夜晚" width="48%">

原型示意；扩展已含书桌、设置/Host、Side Panel ask、外观预设。

## 快速开始

```text
1. 打开 chrome://extensions
2. 打开「开发者模式」
3. 「加载已解压的扩展程序」→ 选仓库里的 extension/ 目录
4. 打开新标签页
```

稳定 ID：`cgkhllpelkjmfamddkjpnmchjikdcbgp`（manifest 公钥）。权限与代理见「隐私」。

## 功能（按 Wave）

**W1 书桌 + 标签**
常用站、待办、便签、这个窗口；左侧「标签」页整理当前窗口。默认跟随系统日夜，轻量光感与玻璃质感。数据在本机 `chrome.storage.local`。

**W2 Host + 设置**
已交付：设置页（连接本机、工作目录）。Host 是可选深路径，书桌不依赖。

**W3 Side Panel 只读 ask**
已交付：左侧栏「对话」与工具栏打开同一 Side Panel；需另装 Host（更新 host.js 后需再跑 `./host/install-host.sh`）。不是主卖点。

**W4 外观预设**
设置页「外观」可切换跟随系统 / 白天 / 夜晚。书桌与 Side Panel 共用同一套 CSS 变量。入口不在书桌第一屏。

## 非目标

天气、番茄钟、壁纸商店、多 CLI、可写 / 强制执行、云同步、Agent Pocket、组件墙。

## 隐私

默认权限是 `storage`、`tabs` 与 `sidePanel`。常用站、待办、便签、称呼、外观预设写在本机 `chrome.storage.local`。当前窗口标签用 `chrome.tabs` 现查，不落盘。当次对话不落盘。无账号，无云同步。连本机 Host 时，设置页才会申请可选的 `nativeMessaging`。出站流量跟随本机 Host 与运行环境（如 `HTTP_PROXY` / `HTTPS_PROXY`）；扩展本身没有代理设置，也不感知代理。

## 路线图

- ✅ W1 书桌 + 标签
- ✅ W1.5 轻量光感 / 玻璃打磨
- ✅ W2 Host + 设置
- ✅ W3 Side Panel 只读 ask
- ✅ W4 外观预设（跟随系统 / 白天 / 夜晚）+ 启动防闪
- ⏸ Chrome 网上应用店上架未定（先自己用一段时间）

## 许可

[MIT](LICENSE)

细节与约定见 [`.sopify/blueprint/`](.sopify/blueprint/)。
