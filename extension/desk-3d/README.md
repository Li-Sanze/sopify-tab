# desk-3d（嵌入 newtab）

Path 3：固定视角微缩桌嵌在新标签页主书桌，不另开独立入口页。

Draft only。Rick 督手测；专项独立审计；Sanze 确认前禁止合并。`host/` 不改。

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
- 侧栏按钮与 3D 拾取走 `DeskUI.openWorkset` / `openNote`。关掉「有 3D」后静态 DOM 桌面仍可用。
- 仅在「有 3D」且舞台可见时 `DeskScene.init()`。空闲停 RAF；无暂停按钮；无 `window` 级唤醒。`shadowMap` 关闭。尊重 `prefers-reduced-motion`。
- 失败（含 `?desk3d=fail`）自动回静态桌面并出横幅。
- 演示数据只写 `sessionStorage`，不写 `chrome.storage`，不恢复真实标签。

## Smoke checklist（Rick）

1. **下一件事 / resume**：第一屏可见，是 `#resume` DOM，不经 3D。打开工作集面板时面板不得盖住它。
2. **有 3D / 无 3D 同一路径**：侧栏按钮、静态桌面按钮、3D 点击都打开同一套演示面板。关掉「有 3D」后静态桌面仍可开工作集 / 便签。
3. **空闲停 RAF**：3D 打开后不悬停，`#desk-3d-mount` 与 canvas 的 `data-desk3d-loop` 应为 `idle`。悬停会短暂 `live`，随后回到 `idle`。没有暂停按钮。
4. **WebGL 失败回退**：`newtab.html?desk3d=fail` 出现「WebGL 不可用」横幅，静态 DOM 桌面仍可用。
