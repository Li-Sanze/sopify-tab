# PR #48 第三轮证明

目的：表单失败重试不再另起一条；旧冲突回执不再把较新冲突盖掉；扩展加载检查只认本扩展 ID。不合入。

基线 tip：`ce7f4ba1b50f20aa51e35713159fd4ca00582c5d`

## 修改前（该 tip 上失败）

对照文件：`docs/evidence/pr48-round3/baseline-ce7f4ba.json`

- 表单路径：首页、对话框新增和保存窗口都在每次提交里调用 `uid()`。新增失败后再提交，第二次的 id 与第一次不同。第一次其实已写入、回执丢失后再提交，存储里变成两条。
- 冲突回执：先看见 V2 冲突，后到的 V1 冲突把展示换成「第一版」rev 1。`acceptRemote` 采纳的是这版旧冲突。

## 修改后

对照文件：`docs/evidence/pr48-round3/after-fix.json`

- 首次发送前记下 opId、itemId 和当时的内容。失败后再提交同一条草稿，复用这两个 id。两条一样的文案如果是两次各自的新增，仍保留两条。提交过程中继续改输入，不会把输入框改回旧快照；只有再提交那次草稿才复用旧 id。常用站按网址一行。窗口保存和删除重试也复用当时的 id，不会删到另一条。
- 成功回执和冲突回执用同一条版本规则。比已看见的版本更旧的冲突不再替换当前冲突，也不会变成已保存。点「使用另一页内容」只采纳当前这一版；版本已经换过就再提示。第二轮的旧成功回执保护还在。
- 扩展目标必须是 `chrome-extension://cgkhllpelkjmfamddkjpnmchjikdcbgp/`。只有别的扩展、或标题像 Sopify 但不是这个 ID 时，加载检查失败。替身通过不算真扩展通过。

终稿闸：`bash scripts/test-reliability.sh` 退出码 0。12 段都是 pass，0 fail，0 skip。分母 12 只含这条脚本里的静态段和替身段，不含真扩展、Host、系统中文输入法、真双页、3D 运行时。

- 静态：`host/test-r1-r7.js`、`host/test-r3-collection.js`、`host/test-r3-form-retry.js`（A–F）、`host/test-r2-note-ack.js`（含冲突门闸 A–E；N8 运行时打印未测）、`host/test-w11-resume.js`、`host/test-w12-workset.js`、`host/test-w4-theme.js`、`host/test-sky-layers.js`、`host/test-desk-companion.js`、`extension/desk-3d/test-gates.js`
- 替身：`host/test-w13-firstscreen.js`（行为与矩阵都 ok；长标题那一行记为 exception-case，不是失败段）、`host/test-r1-r7-browser.js`（55/55）
- Node v22.14.0，Chrome/148.0.7778.96，linux 6.12.94+，调试端口 43589
- 分段文件：`docs/evidence/pr48-round3/reliability-parts.json`

## 验收

见同目录 `acceptance.json`。

## 未测

- 真扩展双页 / `storage.onChanged`：Chrome/148.0.7778.96 忽略 `--load-extension`，目标列表里没有 `chrome-extension://cgkhllpelkjmfamddkjpnmchjikdcbgp/`。未测。
- 系统中文输入法：没有 ibus / fcitx，`GTK_IM_MODULE` 为空。未测。替身里的 composition 事件不算。
- 3D 便签运行时：空间视图默认关闭，本轮没有打开。未测。代码上 3D 保存仍走 `queueNoteSave`。
- Host：本轮没有扩 Host 套件。未测。
