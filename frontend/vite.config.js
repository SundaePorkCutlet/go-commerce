import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api/userfc': {
        target: 'http://localhost:28080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/userfc/, ''),
      },
      '/api/productfc': {
        target: 'http://localhost:28081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/productfc/, ''),
      },
      '/api/orderfc': {
        target: 'http://localhost:28082',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/orderfc/, ''),
      },
      '/api/paymentfc': {
        target: 'http://localhost:28083',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/paymentfc/, ''),
      },
    },
  },
})
