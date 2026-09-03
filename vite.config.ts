import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // React + router num chunk próprio e ESTÁVEL: eles mudam só quando o
        // package.json muda. Sem isso, qualquer deploy troca o hash do chunk
        // principal inteiro e o visitante recorrente baixa React de novo junto
        // com o app — separado, o navegador reaproveita ~45KB gz entre deploys.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Encaminha chamadas de API para o NestJS em dev (quando o backend estiver
      // rodando). VITE_DEV_API aponta o proxy para outro backend — útil para
      // trabalhar contra a VPS sem precisar liberar CORS para o localhost lá.
      '/api': {
        target: process.env.VITE_DEV_API || 'http://localhost:3333',
        changeOrigin: true,
        secure: true,
      },
      // IA local (Ollama) — evita CORS chamando via mesmo origin
      '/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama/, ''),
      },
    },
  },
})
