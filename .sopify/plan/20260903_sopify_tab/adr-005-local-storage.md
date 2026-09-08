# ADR-005: 本机数据落点

## 状态
已采纳

## 上下文
演示把常用站、待办、便签、称呼和工作目录放在页面内存里，把当前窗口标签写成 mock。真扩展必须说清这些信息存在哪。书桌在没有 Host 时也要完整可用，所以不能把书桌数据放到 native host 文件里。

## 决策
用户写下来的书桌数据只进 `chrome.storage.local`：Wave 1 为 `sites` `todos` `notes` `name`，Wave 2 加默认空的 `cwd`，Wave 4 加 `themePreset`（`system`|`day`|`night`，默认 `system`）。当前窗口标签用 `chrome.tabs` 现查，不落盘。当次对话只活在 Side Panel 文档里，关栏即丢。Host 在不在是运行时探测，不写成书桌记录。不落盘 `skyPref`、`cli`、`model`。

第一版不用 `chrome.storage.sync`，不用 IndexedDB，不把这些数据写到用户可见的本地文件。

## 理由
演示文案是「纯文本，只存在本机」。`storage.local` 不经网络、不经 Host、刷新还在，和「装完即可用」一致。标签是当前窗口的活状态，存一份会和真实窗口打架。对话跟侧栏文档走，避免新标签页一点常用站把会话卸掉。

`storage.sync` 有约 100KB 配额，便签容易顶满，也会把本机书桌变成跨设备同步产品，演示没有这条。Host 文件会让没有 Host 的用户丢掉书桌。

## 替代方案
- `chrome.storage.sync`：拒绝。配额和跨设备同步都不在演示里。
- IndexedDB：拒绝。当前数据量用不到。
- Host 或磁盘上的 JSON：拒绝。书桌会依赖 Host。
- 把标签列表写入 `storage`：拒绝。以 `chrome.tabs` 为准。

## 影响
Wave 1 验收以刷新后书桌数据仍在、标签列表不进 `storage` 为准。隐私披露写：用户书桌数据只存在本机当前 Chrome 配置，扩展不上传。

## 修订（W6）
ADR-008 允许 `storage.local` 落盘上游 id `hostUpstream`（`cursor` \| `claude`，默认 `cursor`，不进 `sync`）。仍不落盘模型列表、标签、对话、Host 探测结果。详见 `adr-008-multi-host-thin-adapter.md`。
