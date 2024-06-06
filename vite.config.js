import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3000, // You can specify the port you prefer
  },
  build: {
    outDir: "dist", // Output directory for build files
    sourcemap: true, // Generate source maps for debugging
  },
  resolve: {
    alias: {
      "@": "/src", // Aliases '@' to the '/src' directory
    },
  },
});
