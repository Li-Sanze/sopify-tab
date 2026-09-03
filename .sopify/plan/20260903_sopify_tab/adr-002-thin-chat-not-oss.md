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
流式协议只对接 `cursor-agent` 的 `stream-json`。以后换 CLI 要另开方案，不在第一版做选择器。
