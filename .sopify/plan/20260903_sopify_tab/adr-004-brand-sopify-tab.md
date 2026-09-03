# ADR-004: 品牌与仓库用 Sopify Tab

## 状态
已采纳

## 上下文
仓库名要和品牌对齐。`worktab` 在 Chrome 网上应用店已有产品。`SopifyT` / `SopifyX` 无法发音。用户把 Sopify 当本地品牌。

## 决策
对外名称 Sopify Tab，仓库 `sopify-tab`，host id `com.sopify.tab`。商店短描述：「Calm new tab workbench」。

## 理由
可发音、和仓库一致、不跟 WorkTab 撞名。工作台不是「只管标签」，但 Tab 仍是 Chrome 新标签页品类里能懂的词。

## 替代方案
- worktab: 拒绝。CWS 已有 WorkTab。
- SopifyT / SopifyX: 拒绝。版本后缀，无法口语化。
- Startnook 等更偏书桌的新词: 用户要仓库等于品牌，且已选 Sopify Tab。

## 影响
公开碰撞存在（SOP SaaS、evidentloop/sopify 协议、CWS Shopify 抓取扩展）。上架文案不得暗示那些产品。这不阻止本地品牌使用该名。
