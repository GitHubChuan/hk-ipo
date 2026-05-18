# React TypeScript Template

基于 **Vite + React + TypeScript** 的快手内部全栈项目起始模版，集成了常用依赖和配置，可用于快速搭建新项目。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vite 8 + React 18 + TypeScript 5 |
| UI | shadcn/ui + TailwindCSS v4 |
| 路由 | React Router v7 |
| 状态管理 | Zustand v5 |
| 数据请求 | Fetch API |
| 后端 / 部署 | 参见 `cf-web-artifacts` 或者 `website-builder` skill |

## 目录结构

```
react-ts/
├── src/
│   ├── pages/            # 页面组件
│   ├── components/
│   │   └── ui/           # shadcn/ui 组件（用 npx shadcn@latest add 添加）
│   ├── lib/
│   │   ├── appwrite.ts   # Appwrite client 初始化 + loginWithKuaishou
│   │   └── utils.ts      # tailwind-merge / clsx 工具
│   ├── App.tsx           # 路由配置（React Router <Routes>）
│   ├── main.tsx          # 应用入口
│   └── index.css
├── .env.example          # 环境变量模版
├── .npmrc                # 快手内部 npm 源配置
├── components.json       # shadcn/ui 配置
├── AGENTS.md             # AI Agent 上下文说明
└── README.md
```

## 快速开始

```bash
# 1. 复制环境变量
cp .env.example .env.local
# 填写 VITE_APPWRITE_PROJECT_ID

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev

# 4. 构建
pnpm build
```

## 路由

本模板使用 **React Router v7**，路由配置在 `src/App.tsx`，页面组件放在 `src/pages/`。

**新增页面**：
1. 在 `src/pages/` 下创建页面组件（如 `ProfilePage.tsx`）
2. 在 `src/App.tsx` 的 `<Routes>` 中添加对应 `<Route>`

```tsx
// src/App.tsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/about" element={<AboutPage />} />
</Routes>
```

页面内跳转：

```tsx
import { Link, useNavigate } from 'react-router'

<Link to="/about">关于</Link>

const navigate = useNavigate()
navigate('/about')
navigate(-1) // 返回上一页
```

## 添加更多 shadcn/ui 组件

```bash
npx shadcn@latest add <component-name>
```

## 约束说明

- **npm 源**：必须使用 `https://npm.corp.kuaishou.com/`
- **Appwrite SDK**：只能使用 `@codeflicker/appwrite`，禁用官方包
- **登录**：只允许快手 SSO (`OAuthProvider.Kuaishou`)
- **UI 组件**：推荐使用 shadcn/ui + TailwindCSS

> Appwrite 数据库配置、用户认证、部署等详细说明，请参见 `cf-web-artifacts` skill。
