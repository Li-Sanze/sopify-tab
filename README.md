# Sopify Tab

安静的 Chrome 新标签页工作台。装完即可用。本机 coding CLI 聊天是可选项。

品牌：Sopify Tab  
仓库：`sopify-tab`

Wave 1 交付书桌与标签。设置、Side Panel、本机 Host 不在这一波。

## 未打包加载

1. Chrome 打开 `chrome://extensions`
2. 打开「开发者模式」
3. 「加载已解压的扩展程序」，选本仓库的 `extension/` 目录
4. 打开新标签页，应看到书桌（常用站 / 待办 / 便签 / 这个窗口）和左侧「标签」页

扩展 ID 由 `extension/manifest.json` 的 `key`（公钥）固定，移动目录后不变。当前 ID：`cgkhllpelkjmfamddkjpnmchjikdcbgp`。

私钥不进仓库。unpacked 加载只需要公钥；以后上架签名用的 PEM 由维护者另行保管。

权限只有 `storage` 和 `tabs`。书桌数据（`sites` `todos` `notes` `name`）写在 `chrome.storage.local`。当前窗口标签用 `chrome.tabs` 现查，不落盘。

详见 `.sopify/blueprint/README.md`。
