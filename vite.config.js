export default {
  root: "./src",
  server: {
    port: 3000,
  },
  build: {
    outDir: "../dist",
    rollupOptions: {
      input: "./src/main.js", // Adjust the path to your main JavaScript file
    },
  },
};
