import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: "./",
  publicDir: 'public',
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
    assetsDir: "assets",
    rollupOptions: {
      input: {
        main: "./index.html",
      },
    },
  },
});
