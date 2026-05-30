# 推送到 GitHub 完整指引

> 仓库地址：https://github.com/GitHubChuan/hk-ipo

## 🚀 一次性推送（最快）

如果你只想"现在就把代码推上去"，直接复制下面这段全部到终端执行：

```bash
cd "$(pwd)"  # 确认在项目根目录
git init
git add .
git commit -m "feat: HK IPO 合伙人协作工作台 - 杂志风设计 + 权限系统 + 实时行情"
git branch -M main
git remote add origin https://github.com/GitHubChuan/hk-ipo.git
git push -u origin main
```

执行 `git push` 时，会要求你输入 GitHub 用户名和 **Personal Access Token (PAT)**（不是登录密码！）。

---

## 🔑 方案 A · HTTPS + Personal Access Token（推荐，零配置）

### 步骤 1 · 在 GitHub 申请一个 Token（90 秒）

1. 浏览器打开 → <https://github.com/settings/tokens?type=beta>
2. 点击 `Generate new token` → `Fine-grained tokens`
3. 设置：
   - **Token name**: `hk-ipo-deploy`
   - **Expiration**: 90 days（或更长）
   - **Repository access**: `Only select repositories` → 勾选 `GitHubChuan/hk-ipo`
   - **Repository permissions**:
     - `Contents` → **Read and write**  ← 必须
     - `Metadata` → Read-only（默认）
4. 滚到底点 `Generate token`，**立刻复制**那串 `github_pat_xxxxx`（关掉就再也看不到了）

### 步骤 2 · 推送

```bash
cd /Users/k/Downloads/工作/个人杂想
git init
git add .
git commit -m "init: HK IPO partnership ledger"
git branch -M main
git remote add origin https://github.com/GitHubChuan/hk-ipo.git
git push -u origin main
```

弹出认证：
- **Username**: `GitHubChuan`
- **Password**: 粘贴你的 `github_pat_xxxxx`

### 步骤 3 · 让 macOS 记住凭证（避免每次都贴 Token）

```bash
git config --global credential.helper osxkeychain
```

下次 push 自动从 Keychain 读取，无需再输入。

---

## 🔐 方案 B · SSH（永久免密，强烈推荐长期使用）

### 步骤 1 · 生成 SSH Key（如果已有可跳过）

```bash
ls -la ~/.ssh/id_ed25519.pub  # 检查是否已存在
# 如果不存在：
ssh-keygen -t ed25519 -C "your-email@example.com" -f ~/.ssh/id_ed25519 -N ""
```

### 步骤 2 · 把公钥添加到 GitHub

```bash
cat ~/.ssh/id_ed25519.pub | pbcopy   # macOS 自动复制到剪贴板
```

打开 <https://github.com/settings/ssh/new>，标题随便填（如 `MacBook-2026`），把剪贴板内容贴进 Key 框，点 `Add SSH key`。

### 步骤 3 · 测试连接

```bash
ssh -T git@github.com
# 期待输出：Hi GitHubChuan! You've successfully authenticated...
```

### 步骤 4 · 推送

```bash
cd /Users/k/Downloads/工作/个人杂想
git init
git add .
git commit -m "init: HK IPO partnership ledger"
git branch -M main
git remote add origin git@github.com:GitHubChuan/hk-ipo.git
git push -u origin main
```

✅ 永远不会再要密码。

---

## 🔄 后续日常更新

```bash
# 1. 看看改了哪些文件
git status

# 2. 暂存全部修改
git add .

# 3. 提交（消息按惯例写）
git commit -m "feat: 新增暗盘行情接入"
# 或
git commit -m "fix: 修复 Allocation 期望计算"

# 4. 推上去
git push
```

提交消息约定（不强制，但好维护）：
- `feat: ` 新功能
- `fix: ` 修 Bug
- `style: ` UI 调整
- `refactor: ` 重构
- `docs: ` 文档

---

## 🌍 顺手开通 GitHub Pages（免费托管前端）

仓库推上去后：

1. 浏览器打开 <https://github.com/GitHubChuan/hk-ipo/settings/pages>
2. **Source** 选 `GitHub Actions`
3. 在项目根创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Pages
on:
  push:
    branches: [main]
permissions:
  pages: write
  id-token: write
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: ./dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

> ⚠️ 同时打开 `vite.config.ts`，加上 `base: '/hk-ipo/'`（仓库名），不然部署后样式找不到。

```ts
// vite.config.ts
export default defineConfig({
  base: '/hk-ipo/',
  // ...其它配置
})
```

提交并推送后，几分钟内你的网站会出现在：
**https://githubchuan.github.io/hk-ipo/**

---

## 🆘 常见问题速查

| 问题 | 解决 |
|---|---|
| `error: failed to push some refs` | 远端有内容：`git pull --rebase origin main && git push` |
| `Permission denied (publickey)` | SSH key 没加到 GitHub，回到方案 B 步骤 2 |
| `support for password authentication was removed` | GitHub 早就不让用密码了，必须用 PAT 或 SSH |
| `Repository not found` | 检查 `git remote -v` 里 URL 拼写、大小写、组织/账号 |
| 想换远程地址 | `git remote set-url origin git@github.com:GitHubChuan/hk-ipo.git` |
| 想撤销最后一次 commit（未 push）| `git reset --soft HEAD~1` |
| 不小心把敏感信息提交了 | 立即换 token；用 `git filter-repo` 或 BFG 清历史 |

---

## ✅ 我推荐的最终配置

1. **凭证**：方案 B（SSH key）+ macOS Keychain 保险
2. **分支策略**：单人项目就一个 `main`，多人时再开 `dev` / `feature/xxx`
3. **托管**：GitHub Pages（免费）；想要自定义域名再加 CNAME
4. **更新流程**：本地写 → `git add . && git commit -m "..." && git push` → Pages 自动构建上线

完成 ✦
