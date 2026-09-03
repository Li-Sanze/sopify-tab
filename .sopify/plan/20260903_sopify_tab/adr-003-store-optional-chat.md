# ADR-003: 商店包是书桌，聊天可选

## 状态
已采纳

## 上下文
Native host 不能放进 CRX。本机 CLI 也不是每个用户都有。若聊天写成必装，上架和安装体验都会裂。

## 决策
CRX 交付工作台。`nativeMessaging` 作为可选权限。Host 用 GitHub Release + `install-host.sh`。无 Host / CLI 时书桌必须完整可用。

## 理由
Chrome 网上应用店路径要求「装完即可用」。Codex 审计也要求诚实写「只读本机 CLI 问答」，并把 install 合同说清楚。

## 替代方案
- 只做 unpacked 自用: 拒绝。用户要可上架。
- 聊天作为商店主功能: 拒绝。Host 无法随包分发，单一用途也难写。

## 影响
listing 主标题与短描述谈工作台。聊天空态只解释如何另装 Host。扩展 ID 必须稳定，否则 `allowed_origins` 会随路径失效。
