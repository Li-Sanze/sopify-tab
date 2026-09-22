# desk-3d（嵌入 newtab）· Studio 03 空间桌面

Path 3：固定视角空间桌嵌在新标签页主书桌。视觉收敛为简约厚实圆角桌 + 三个功能物件（屏幕 / 资料夹 / 随手记）。

本波基于 PR #33 tip（`window.SopifyDesk3d` 真实接线）移植 Studio 03 示范。Draft only。不合 main；不覆盖 #33 分支。`host/` 不改。

## 干净配置加载（给 Rick / 验收官）

**Google Chrome 148+ 会忽略 `--load-extension`（日志：`not allowed in Google Chrome, ignoring`）。验收必须用「加载已解压」，不要空转 CLI。**

### 推荐（可复现 · 验收用）

```text
1. 启动干净配置（任选）：
   /usr/bin/google-chrome-stable --user-data-dir="$HOME/sopify-tab-clean-profile" --no-first-run
2. 打开 chrome://extensions
3. 打开右上角「开发者模式」
4. 「加载已解压的扩展程序」→ 指向本仓库的 extension/ 目录
   （该目录内必须直接有 manifest.json；不要选仓库根或 host/）
5. 确认列表出现「Sopify Tab」卡片，ID = cgkhllpelkjmfamddkjpnmchjikdcbgp
6. Ctrl/Cmd+T 打开新标签页 → 应为本扩展 NTP（我的工作台），不是 Google 默认页
7. 地址栏可核对：chrome-extension://cgkhllpelkjmfamddkjpnmchjikdcbgp/newtab.html
```

失败回退：`chrome-extension://cgkhllpelkjmfamddkjpnmchjikdcbgp/newtab.html?desk3d=fail`

### CLI（仅 Chromium / 可开 LoadExtension 的构建）

```bash
# 不要对 Google Chrome 148 指望 --load-extension
chromium --user-data-dir="$HOME/sopify-tab-clean-profile" \
  --disable-features=DisableLoadExtensionCommandLineSwitch \
  --load-extension="$(pwd)/extension" \
  --disable-extensions-except="$(pwd)/extension"
```

辅助脚本：`scripts/load-extension.sh`（优先找 Chromium；对 branded Chrome 只开干净 profile，并打印上述警告）。

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

## Smoke checklist（Rick）

1. **下一件事 / resume**：第一屏可见，是 `#resume` DOM，不经 3D。
2. **真实数据**：有已保存工作集时桌面出现屏幕（第 1）/ 资料夹（第 2）；没有则空。便签是书桌那一条。
3. **空间 / 简洁同一路径**：侧栏按钮、静态桌面按钮、3D 点击、浮动标签都打开同一套真实面板。
4. **空闲停 RAF**：3D 打开后不悬停，`#desk-3d-mount` 与 canvas 的 `data-desk3d-loop` 应为 `idle`。
5. **WebGL 失败回退**：`newtab.html?desk3d=fail` 出现「WebGL 不可用」横幅，简洁桌面仍可用。
