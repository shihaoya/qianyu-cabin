import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue()],
    server: {
      port: Number(env.DEV_PORT) || 5173,
      strictPort: true,
      proxy: {
        '/server': {
          target: env.API_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
