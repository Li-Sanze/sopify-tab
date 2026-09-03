# 蓝图设计

## 正式契约
- 商店包交付工作台。聊天失败不得破坏桌面。
- native host 不进 CRX；`allowed_origins` 使用商店/稳定扩展 ID。
- 调用本机 CLI 必须走 install 时快照的绝对路径，优先 `cursor-agent-proxy`，禁止快照版本目录。
- `--mode ask`，不传 `--force`，cwd 只能是设置里的工作目录。
- 关闭 Side Panel 必须结束 native port 并杀掉整棵子进程树。

## 模块与消费边界
- `newtab.*`: 工作台与当前窗口标签网格。一点链接会卸掉该页，因此不承载 agent 会话。
- `sidepanel.*`: 聊天 UI 与连接说明。会话活在侧栏文档里。
- `background.js`: 权限、sidePanel 行为、消息转发。不把长任务放在 service worker 里硬撑。
- `host/`: 本机 native host 与 `install-host.sh`。Node 解释器路径由 install 写入，禁止依赖 Chrome GUI 的 `PATH` 去找 nvm。
