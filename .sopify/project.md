# 项目技术约定

## 技术栈
- 核心: Chrome Manifest V3，Vanilla HTML / CSS / JavaScript
- 构建: 第一版不引入打包器；native host 用 Node，install 脚本写入本机绝对路径
- 测试: 第一版以 `chrome://extensions` unpacked 手工验收为主

## 使用约定
- 仓库名与品牌对齐：`sopify-tab` / Sopify Tab。
- 新标签页 Wave 1 只有书桌和标签。设置 Wave 2 才加。对话在 Side Panel，Wave 3 才出现入口。第一屏不提 Host。
- 用户书桌数据只进 `chrome.storage.local`（`sites` `todos` `notes` `name`，Wave 2 加 `cwd`）。当前窗口标签用 `chrome.tabs` 现查。当次对话不落盘。
- 扩展用稳定 `key`，native host 的 `allowed_origins` 只允许本扩展。
- `nativeMessaging` 作为可选权限，用户点连接后再申请。
- 不接 Multica 产品。聊天自研薄层，接到本机 CLI。
- 不 fork 乔木 Tab / Tab Out 源码，只参考交互。
- host 不得覆盖本机已有的 Codex / Qoder native host 清单。

## 文档边界
- `project.md`: 技术约定
- `blueprint/background.md`: 长期目标、范围与非目标
- `blueprint/design.md`: 模块、宿主、目录与消费契约
- `blueprint/tasks.md`: 未完成长期项与明确延后项
