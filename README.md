# Sopify Tab

![书桌](prototype/shots/desk.png)

打开新标签页，先看到「下一件事」和当前窗口。

没有未完成待办时，锚点空着：点「写一条」去写。工作集是旁边的支撑，不是主舞台。

<img src="prototype/shots/day.png" alt="白天" width="48%"> <img src="prototype/shots/night.png" alt="夜晚" width="48%">

## 快速开始

```text
1. chrome://extensions
2. 打开「开发者模式」
3. 「加载已解压的扩展程序」→ extension/
4. 打开新标签页
```

稳定 ID：`cgkhllpelkjmfamddkjpnmchjikdcbgp`。权限见「隐私」。

## 书桌

- **下一件事**：第一条未完成待办。没有待办时显示「还没有下一件事」，点「写一条」聚焦待办输入框。不拿标签或便签凑数。
- **这个窗口**：当前窗口的 http(s) 和 localhost。筛选后最多显示 5 条，点一行切到那个标签。
- **工作集**：只有点「保存这个窗口」才写入本机。最多 5 个；满了会问要不要覆盖最早的，不会悄悄丢掉。每个工作集最多 50 个网页，超过会确认后只留前 50；标题约 200 字。书桌一行「最近一份 · 恢复」；设置里列出全部，可删一条或「清空全部工作集」。恢复时打开当前窗口还没有的网址，已打开的同一网址就切过去，不关掉其它标签。关窗口不会自动存。
- 待办、便签、常用站还在。常用站不再占满整行。

## 隐私

权限：`storage`、`tabs`、`sidePanel`。无账号、无云同步、无新权限。

本机 `chrome.storage.local` 现有键：常用站、待办、便签、称呼、外观、上游选择、工作目录，以及工作集 `worksets`。

`worksets` 形状：`[{ id, name, savedAt, tabs:[{ title, url }] }]`。不存 favicon、不存 tabId。只收 http(s) 和 localhost。只在明确保存时写入。最多 5 个工作集；每个最多 50 个网页。可删、可清空。不用 `storage.sync`。不用 sessions / history / bookmarks。

当前窗口标签现查，不自动落盘。对话不落盘。连 Host 才申请 `nativeMessaging`。出站跟本机环境（如 `HTTP_PROXY`）；扩展无代理设置。

## 可选：本机对话

设置深路径。没装 Host，书桌照常用。默认仍是 Cursor。Claude 只读、Codex 只读，都要本机已装对应 CLI。不能写盘、执行或传 `--force`。

## 非目标

天气、番茄钟、壁纸商店、任意 Agent、未接线 CLI、可写执行、云同步、Agent Pocket、组件墙、书签/历史聚类。

## 路线图

W1–W4、W6、W9–W12 已落地。商店上架（W5）暂停。

## 许可

[MIT](LICENSE) · [`.sopify/blueprint/`](.sopify/blueprint/)
