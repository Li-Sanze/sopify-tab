# Sopify Desk 3D — 参考原型

验证「**固定视角 3D 工作桌 + 原生 DOM 操作面板**」。

主交付是 **newtab 内嵌**（Path 3）。本页只是仓库内参考，不是独立产品入口。

共享模块：`extension/desk-3d/`（含本地 Three.js r170 ESM，约 1.25 MiB，无 CDN）。

## 启动

须从**仓库根**起 HTTP（ESM 要跨到 `extension/desk-3d/`）：

```bash
cd /path/to/sopify-tab
python3 -m http.server 8765
```

打开：`http://127.0.0.1:8765/prototype/desk-3d/`

不要用 `file://`。

## 如何验证

1. **有 3D**：舞台显示微缩桌；单击文件夹 / 便签打开 DOM 面板。侧栏按钮走同一处理函数。
2. **无 3D**：取消「有 3D」→ 静态 DOM 桌面，同一套入口。
3. **下一件事**：底部始终可见；打开面板时不得盖住它（`--next-h` / `--resume-bottom`）。
4. **停渲**：空闲停 RAF；无暂停按钮；无 window 级唤醒。`prefers-reduced-motion` 时减少抗锯齿与悬停抬起。
5. **失败**：`?desk3d=fail` 应落到静态 DOM 并出横幅。

本原型**没有**：自由漫游、真实标签恢复、`chrome.storage`、Host 改动。
