import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: { port: 6969 },
  build: {
    rollupOptions: {
      output: {
        // Keep the large Firebase SDK in its own cached file.
        manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/ai'] },
      },
    },
  },
})
