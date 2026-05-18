# AGENTS.md

## 项目概览

本项目基于 `website-builder` skill 构建的港股打新合伙人管理网站。

- **前端**：Vite + React + TypeScript
- **UI**：shadcn/ui + TailwindCSS
- **后端**：快手内部 Appwrite（endpoint: `https://frontend-cloud.corp.kuaishou.com/v1`）
- **设计风格**：采用精致编辑/杂志风格 (Editorial/Magazine style)，追求高度数据信息密度的同时保持排版优雅。**严禁使用通用AI美学（如白色背景+紫色渐变）、默认系统字体。** 需采用出人意料且美观的衬线与无衬线字体组合，精心控制留白。

## 构建与启动命令

- 安装依赖：`npm install`
- 启动开发服务器：`npm run dev`
- 构建产物：`npm run build`
- 部署：参见 `static-site-deploy` skill

## 安全约束（禁止违反）

- 登录只允许快手 SSO（`OAuthProvider.Kuaishou`）
- CLI 只允许 `appwrite-cf`，SDK 只允许 `@codeflicker/appwrite`
- npm 源：`https://npm.corp.kuaishou.com/`
- project_id 不允许含连字符（`-`）
