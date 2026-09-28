# PR #48 第二轮证明

目的：关掉两页同时新增时整份列表互相覆盖，以及旧便签成功回执把较新冲突清掉。不合入。

基线 tip：`89bb7686a4688d19574745b0be58f97955deefc0`

## 修改前（该 tip 上失败）

对照文件：`docs/evidence/pr48-round2/baseline-89bb768.json`

命令是把该 tip 的 `extension/note-sync.js` 取出来，用三个独立 realm 跑交接里的旧回执时序；P1 用当时页面的整表写法（两边都从 `[old]` 拼出下一份再写入）。

- N1：存储已是「B 后来保存的新内容」rev 2。A 收到自己的 V1 回执后 `ok: true`，`conflict` 被清空，rev 回到 1，草稿和已确认内容都变成 A。按这个状态会显示「已存在本机」。
- P1：两次都 `ok: true`，存储只剩 `old` 和 `B`，`A` 丢掉。

## 修改后

- 待办、常用站、存下的窗口提交新增／修改／删除。后台同一域里先读最新，再应用意图，再写，再带回版本。同一 id（常用站按网址）重试不会多插一条。读失败的禁写还在。
- 便签回执认请求标识和已看见的版本。已经看见更新的版本之后，更旧的成功回执不再降级、不再清冲突、不再当成「已存在本机」。`pumpNoteSave` 先问 `shouldMarkNoteSaved`。3D 便签仍走 `queueNoteSave`，本轮没有打开空间视图。

终稿闸：`bash scripts/test-reliability.sh` 退出码 0。11 段都是 pass，没有 skip。分母不含真扩展、Host、系统中文输入法、真双页、3D。

- 静态：`host/test-r1-r7.js`、`host/test-r3-collection.js`（T1–T10）、`host/test-r2-note-ack.js`（N1–N8；N8 运行时打印未测）、`host/test-w11-resume.js`、`host/test-w12-workset.js`、`host/test-w4-theme.js`、`host/test-sky-layers.js`、`host/test-desk-companion.js`、`extension/desk-3d/test-gates.js`、`host/test-w13-firstscreen.js` 的静态部分
- 替身：`host/test-w13-firstscreen.js`，`host/test-r1-r7-browser.js`（55/55）
- Node v22.14.0，Chrome/148.0.7778.96，linux 6.12.94+，调试端口 43349

T1 在终稿里：A、B 都从 `[old]` 做出新增，A 的写入被 barrier 挡住后再放行 B。两次都成功，存储含 old、A、B。

## 验收

见同目录 `acceptance.json`。真扩展、Host、真中文 IME、真双页扩展、3D 便签仍是未测。
