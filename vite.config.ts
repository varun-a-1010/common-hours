import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5192,
    strictPort: true,
    proxy: {
      // Preserve the browser-facing Host for the API's same-origin mutation check.
      '/api': { target: 'http://127.0.0.1:3192', changeOrigin: false },
    },
  },
  build: { outDir: 'dist/client' },
});
