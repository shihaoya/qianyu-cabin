import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: '/m/',
    plugins: [vue()],
    resolve: {
      alias: {
        // 共享代码（引擎/配置/公共组件），位于仓库根的 shared/ 目录
        '@cabin': fileURLToPath(new URL('../shared', import.meta.url)),
      },
    },
    server: {
      port: Number(env.DEV_PORT) || 5174,
      strictPort: true,
      // 允许访问仓库根（shared/ 在 mobile/ 之外，需显式放行）
      fs: {
        allow: [fileURLToPath(new URL('../', import.meta.url))],
      },
      proxy: {
        '/server': {
          target: env.API_TARGET || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/server/, ''),
        },
      },
    },
  }
})
