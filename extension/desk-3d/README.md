# desk-3d（嵌入 newtab）

Path 3：固定视角微缩桌嵌在新标签页主书桌，不另开独立入口页。

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

## 本地加载

```text
chrome://extensions → 开发者模式 → 加载已解压的扩展程序 → extension/
然后打开新标签页
```
