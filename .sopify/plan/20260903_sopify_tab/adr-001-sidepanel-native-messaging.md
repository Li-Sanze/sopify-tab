# ADR-001: Side Panel + Native Messaging

## 状态
已采纳

## 上下文
Chrome 扩展不能直接 spawn 本机 CLI。新标签页是 `chrome_url_overrides`，用户一点常用站该文档就会卸载。聊天若放在新标签页 DOM 里，会话会一起死。

## 决策
聊天放在 Side Panel。经 `chrome.runtime.connectNative` 调本机 host。关掉侧栏即停当次 agent。第一版不跑常驻 localhost sidecar。

## 理由
侧栏文档可以跟着浏览留下去。Native Messaging 少一个常驻进程。用户已选这条，并接受 PATH / alias 要靠 install 快照绝对路径。

## 替代方案
- 新标签页内嵌聊天: 拒绝。点链接会卸载页面。
- localhost sidecar: 拒绝作为第一版。PATH 更稳，但多一个常驻进程。
- Native host 再拉 sidecar: 能力最全，故障面最大，不适合第一版。

## 影响
install 必须写入 Node 与 `cursor-agent-proxy` 的绝对路径。Host 不能进商店包。关侧栏必须杀进程树。
