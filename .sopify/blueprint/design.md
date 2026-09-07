# 蓝图设计

## 正式契约
- 商店包交付工作台。没连 Host 不是故障，不得破坏桌面。
- 默认不连、第一屏不提 Host。对话入口要到能发送时才出现。
- `prototype/index.html` 是视觉参考。真对话在 Side Panel，不进新标签页 DOM。
- 用户书桌数据只进 `chrome.storage.local`。当前窗口标签用 `chrome.tabs` 现查。当次对话不落盘。
- native host 不进 CRX；`allowed_origins` 使用商店/稳定扩展 ID。
- 调用本机 CLI 必须走 install 时快照的绝对路径，只接 `cursor-agent-proxy`，禁止快照版本目录。
- `--mode ask`，不传 `--force`，cwd 只能是设置里的工作目录。
- 关闭 Side Panel 必须结束 native port 并杀掉整棵子进程树。
- 用户可见文案与 listing 必须写清：只读本机 Cursor CLI、另装 Host、不是本地模型、不能写执行。聊天不是主卖点，但不得隐藏。

## 模块与消费边界
- `newtab.*`: 书桌与标签。读 `storage.local` 和当前窗口 `tabs`。一点链接会卸掉该页，因此不承载 agent 会话，也不渲染 Host 状态。
- 设置页: Host 说明、工作目录、外观预设。检测失败只留在本页。
- `sidepanel.*`: Wave 3 才出现。聊天 UI 与连接说明。会话活在侧栏文档里，不写 `storage`。
- `background.js`: Wave 3 才出现。sidePanel 行为、消息转发。
- `host/`: 本机 native host 与 `install-host.sh`。不存放常用站、待办、便签。
