import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 8080,
    proxy: {
      '^/(api|assets|files|private)': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: '../erpnext_scrum/public/frontend',
    emptyOutDir: true,
    target: 'es2015',
    rollupOptions: {
      output: {
        entryFileNames: `index.js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`
      }
    }
  }
})
