# ADR-002: 自研薄聊天层

## 状态
已采纳

## 上下文
需要本机 CLI 问答，但产品主交付是书桌。开源聊天产品会把扩展做成套壳，也难通过「单一用途」上架叙事。

## 决策
Side Panel 自研薄 UI。不嵌入 Open WebUI、LibreChat、assistant-ui、Multica。

## 理由
第一版只要输入、流式文本、停止 / 重试 / 新会话。重聊天框架会倒逼权限、状态和 listing 文案。

## 替代方案
- 嵌入开源聊天前端: 拒绝。体积、权限、产品叙事都不匹配。
- 跳到 ChatGPT / 豆包网页: 拒绝。用户已否定这条。
- 接 Multica 守护进程: 拒绝。用户不要依赖 Multica 产品。

## 影响
本方案只对接 `cursor-agent` 的 `stream-json`。不做 CLI 选择器，不检测 Claude / Codex。其它 CLI 另开方案。

## 修订（W6）
ADR-008 在同一 Side Panel 合同下另立项多 Host 薄适配。本 ADR 的「薄聊天、不嵌开源套壳」仍有效。「只对接 Cursor / 不做选择器」改为：默认 Cursor；设置深路径可选已接线上游。详见 `adr-008-multi-host-thin-adapter.md`。
