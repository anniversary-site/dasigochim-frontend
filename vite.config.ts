import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080';

  return {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5175,
    proxy: {
      '/api': {
        target: backendProxyTarget,
        changeOrigin: true,
      },
      '/files': {
        target: backendProxyTarget,
        changeOrigin: true,
      },
      // 다시고침 백엔드 (Spring Boot) — /api/v1/** → 백엔드로 프록시 (CORS 회피)
      // 백엔드 포트/주소가 다르면 target만 수정
      '/api/v1': {
        target: backendProxyTarget,
        changeOrigin: true,
      },
    },
  },
  };
})
