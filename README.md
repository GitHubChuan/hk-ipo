# 港股打新合伙人工作台 · The IPO Ledger

> 一份杂志感的"账本"——4–5 位合伙人共享一颗大脑，把每一支港股新股的评估、申购、卖出、分润、复盘全部沉淀成可量化的决策。

[![Deploy on Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

## ✨ 特性

| 模块 | 内容 |
|---|---|
| **§I 总览** | 头版头条、本期重点推荐、累计盈亏 KPI、跳转捷径 |
| **§II 标的评估** | 录入新股 → 自动算"单手期望利润 / 中签率 / 推荐档位" |
| **§III 额度分配** | 多新股并发时按赚钱期望排序，优先吃满高期望标的 |
| **§IV 持仓申购** | 每位合伙人在每只新股的申购明细、融资成本、中签结果 |
| **§V 卖出分润** | 暗盘/开盘/止损建议；一键计算各合伙人净分润（自动处理主理人兜底） |
| **§VI 历史复盘** | 累计盈亏、月度走势、合伙人收入榜、逐笔流水 |
| **§VII 设置** | 合伙人花名册、分润比例、访问口令、全局参数 |

## 🧠 核心算法

**赚钱期望 = 一手中签率 × 一手金额 × 预期涨幅**

- **一手中签率** 经过红鞋机制加权：`min(1, max(1/超购倍数 × 红鞋系数, 下限))`
  - 超购 < 50 倍 → 一手党最少 50%
  - 超购 50–200 倍 → 最少 30%
  - 超购 > 200 倍 → 最少 15%
- **多标的并发** 时按期望从高到低排序：强烈推荐者优先吃满预算，其余按"全员各摸 1 手"红鞋套利
- **离场建议** 基于上市/暗盘价对发行价的涨幅：≥30% 暗盘出货 / ≥15% 部分锁利 / <-10% 止损

## 🚀 快速开始

```bash
npm install
npm run dev      # 本地开发
npm run build    # 生产构建
```

启动后默认访问密码：**`hkipo2026`**（首次登录后请到「设置」修改）。

## 🌐 部署到公网

```bash
# Vercel（推荐）
vercel --prod

# 或者：任何静态托管（Netlify / GitHub Pages / Cloudflare Pages）
# 直接把 dist/ 上传即可，已配置好 SPA 重写（vercel.json）
```

> 没有任何后端依赖，所有数据保存在每位合伙人自己的浏览器 LocalStorage 中。

## 🎨 设计

精致编辑/杂志风（Editorial / Magazine）：
- **字体**：`Cormorant Garamond` 衬线大标 × `Inter` 无衬线正文 × `JetBrains Mono` 数字
- **配色**：象牙纸底 `#F5F2EA` + 深墨黑 `#1A1813` + 朱砂红强调 `#B83A2B`
- 杂志感分割线、卷数索引（§I–§VII）、隶书数字（壹/贰/叁）

## 🔒 安全

- 不依赖任何 SSO，公网可直接访问
- 用团队共享口令（哈希存储在浏览器）作为访问门槛
- 所有业务数据**永远不离开浏览器**，云端零存储

## 📁 目录

```
src/
├── lib/
│   ├── types.ts        # IPO/Partner/Subscription/Sale/Settlement 类型
│   ├── engine.ts       # 决策引擎（期望、中签率、额度分配、离场建议、分润）
│   └── store.ts        # Zustand + persist
├── components/
│   ├── shared/Editorial.tsx   # 杂志风通用组件
│   └── tabs/                  # §I~§VII 七个 Tab
├── pages/
│   ├── LoginPage.tsx
│   └── DashboardPage.tsx
└── App.tsx
```

## 🛠️ 技术栈

Vite 7 · React 18 · TypeScript 5 · TailwindCSS 4 · Zustand 5 · React Router 7
