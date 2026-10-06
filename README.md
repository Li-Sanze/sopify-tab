<p align="center"><img src="extension/icons/icon128.png" width="72" alt=""></p>

<h1 align="center">Sopify Tab</h1>

<p align="center">安静的 Chrome 新标签页。打开先看到「下一件事」，不是搜索框，也不是壁纸。<br>
<sub>A quiet Chrome new tab that shows your next thing first.</sub></p>

![Sopify Tab 首屏](docs/images/desk-day.png)

## 它做什么

- **下一件事**：首屏只放一条待办。做完点「完成」，下一条自动顶上；点错了可以撤销。
- **存下这个窗口**：一键把当前窗口的网页存下，下次一键恢复，已经开着的不会重复打开。
- **随手记**：首屏直接写，自动存在本机。
- **常用站**：几个常去的网站，放在最下面。
- **当前标签**：按网站分组，可以筛选、整组关掉；关错了能重新打开。

## 安装

还没上架 Chrome 网上应用店，先用开发者模式加载：

1. 下载本仓库（Code → Download ZIP）并解压，或者 `git clone`。
2. 打开 `chrome://extensions`，打开右上角的「开发者模式」。
3. 点「加载已解压的扩展程序」，选择仓库里的 `extension/` 目录。
4. 按 Cmd/Ctrl+T，新标签页就是 Sopify Tab。

## 隐私

- 只要 `storage` 和 `tabs` 两个权限。
- 没有账号，没有云同步，不向任何服务器发送数据。
- 当前窗口的网页只有在你点「保存这个窗口」时才会存下，只存标题和网址，最多存 5 份。

## 不做什么

天气、番茄钟、壁纸、组件墙、云同步。

## 开发

```bash
bash scripts/test-reliability.sh   # 需要 Node 22+ 和本机 Chrome
```

测试覆盖范围、并发写入的约定、旧版本地 Host 的卸载方法，见 [docs/development.md](docs/development.md)。

## 许可

[MIT](LICENSE)
