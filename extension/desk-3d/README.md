# desk-3d（嵌入 newtab）· Studio 03 空间桌面

Path 3：固定视角空间桌嵌在新标签页主书桌。视觉收敛为简约厚实圆角桌 + 三个功能物件（屏幕 / 资料夹 / 随手记）。

本波基于 PR #33 tip（`window.SopifyDesk3d` 真实接线）移植 Studio 03 示范。Draft only。不合 main；不覆盖 #33 分支。`host/` 不改。

## 干净配置加载（给 Rick）

不要用日常 Chrome。空用户目录、只装这一份扩展：

```text
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --user-data-dir="$HOME/sopify-tab-clean-profile" --no-first-run

# Linux
google-chrome --user-data-dir="$HOME/sopify-tab-clean-profile" --no-first-run

# Windows
"%ProgramFiles%\Google\Chrome\Application\chrome.exe" ^
  --user-data-dir="%USERPROFILE%\sopify-tab-clean-profile" --no-first-run
```

1. 打开该窗口的 `chrome://extensions`
2. 打开「开发者模式」
3. 「加载已解压的扩展程序」→ 仓库里的 `extension/`（绝对路径，不要选仓库根或 `host/`）
4. 确认扩展 ID 为 `cgkhllpelkjmfamddkjpnmchjikdcbgp`
5. 关掉这个配置里其它新标签页扩展
6. 打开新标签页（Ctrl/Cmd+T），不要打开旧的 chrome://newtab 缓存页

失败回退：同一新标签页加 `?desk3d=fail`（扩展页把查询串加在 `chrome-extension://<id>/newtab.html?desk3d=fail`）。

## 体积

| 文件 | 版本 | 约大小 |
|------|------|--------|
| `vendor/three/three.module.js` | r170 / 0.170.0 | **1,314,681 bytes（~1.25 MiB）** 未压缩 ESM |

无 CDN。MIT 见 `LICENSE-THIRD-PARTY.md`。

## 行为

- 「下一件事」是 `#resume`，纯 DOM，不经 3D。面板用 `--next-h` / `--resume-bottom`（ResizeObserver）避开它。
- 默认「空间视图」打开。关掉后「简洁视图」静态 DOM 桌面仍可用。
- 桌面最多 **两个** 工作集物件（屏幕 + 资料夹）；多余在侧栏列表 / 「查看全部工作集」进标签页。
- 随手记 = 书桌那一条 `notes` 字符串。空着就空着，不造第二条。
- 点击物件打开工作集面板或便签；「恢复」走 newtab 注入的 `restoreWorksetById`。
- desk-3d 自己不读 `chrome.storage` / `chrome.tabs`。只吃 `window.SopifyDesk3d` 回调。
- 仅在空间视图且舞台可见时 `DeskScene.init()`。空闲停 RAF；无 `window` 级唤醒。`shadowMap` 关闭（接触阴影为假阴影盘）。尊重 `prefers-reduced-motion`。
- 跟随 `data-sky` / `sopify-theme` 切换昼夜材质。
- 失败（含 `?desk3d=fail`）自动回简洁桌面并出横幅。
- 无 desk-3d `sessionStorage` 种子，无模拟恢复，无示范页脚。
- 桌面软团（companion）默认关闭，避免与三物件桌面冲突。

## Smoke checklist（Rick）

1. **下一件事 / resume**：第一屏可见，是 `#resume` DOM，不经 3D。
2. **真实数据**：有已保存工作集时桌面出现屏幕（第 1）/ 资料夹（第 2）；没有则空。便签是书桌那一条。
3. **空间 / 简洁同一路径**：侧栏按钮、静态桌面按钮、3D 点击、浮动标签都打开同一套真实面板。
4. **空闲停 RAF**：3D 打开后不悬停，`#desk-3d-mount` 与 canvas 的 `data-desk3d-loop` 应为 `idle`。
5. **WebGL 失败回退**：`newtab.html?desk3d=fail` 出现「WebGL 不可用」横幅，简洁桌面仍可用。
