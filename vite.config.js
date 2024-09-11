import { defineConfig } from 'vite';

export default defineConfig({
  root: "./",
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3210',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: "./dist",
    rollupOptions: {
      input: "./src/main.js",
    },
  },
});
