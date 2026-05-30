import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 部署在 https://githubchuan.github.io/hk-ipo/ 下
  // 必须设置 base 为仓库名，否则资源 (JS/CSS) 路径会 404
  base: '/hk-ipo/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
