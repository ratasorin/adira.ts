import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./frontend", import.meta.url)) },
  },
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
    commonjsOptions: { include: [/node_modules/, /packages\/core\/dist/] },
  },
  optimizeDeps: { include: ["@n/adira.core.ts"] },
  server: { port: 5174, proxy: { "/api": "http://127.0.0.1:5400" } },
});
