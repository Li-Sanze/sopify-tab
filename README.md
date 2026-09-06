# Sopify Tab

安静的 Chrome 新标签页书桌——装完即用，值得当默认页；本机 Cursor 问答可选。

![书桌](prototype/shots/desk.png)

<img src="prototype/shots/day.png" alt="白天" width="48%"> <img src="prototype/shots/night.png" alt="夜晚" width="48%">

原型视觉。当前扩展交付书桌与标签。

## 快速开始

```text
1. 打开 chrome://extensions
2. 打开「开发者模式」
3. 「加载已解压的扩展程序」→ 选仓库里的 extension/ 目录
4. 打开新标签页
```

稳定 ID：`cgkhllpelkjmfamddkjpnmchjikdcbgp`（manifest 公钥）。权限只有 `storage` 与 `tabs`。

需另装 Host + Cursor ask。

## 功能（按 Wave）

**W1 书桌 + 标签**
常用站、待办、便签、这个窗口；左侧「标签」页整理当前窗口。跟随系统日夜。数据在本机 `chrome.storage.local`。

**W1.5 浅色天空 / 玻璃**
轻量天空与玻璃质感。

**W2 Host + 设置**
未交付。

**W3 Side Panel 只读 ask**
未交付。

## 非目标

天气、番茄钟、壁纸商店、多 CLI、可写 / 强制执行、云同步、Agent Pocket、组件墙。

## 隐私

权限只有 `storage` 与 `tabs`。常用站、待办、便签、称呼写在本机 `chrome.storage.local`。当前窗口标签用 `chrome.tabs` 现查，不落盘。无账号，无云同步。

## 路线图

- ✅ W1 书桌 + 标签
- ✅ W1.5 浅色天空 / 玻璃打磨
- 🔜 W2 Host + 设置
- 🔜 W3 Side Panel 只读 ask
- ⏸ Chrome 网上应用店上架未定（先自己用一段时间）

## 许可

[MIT](LICENSE)

细节与约定见 [`.sopify/blueprint/`](.sopify/blueprint/)。
