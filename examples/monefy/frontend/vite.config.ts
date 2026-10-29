import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: process.env.API_UPSTREAM || "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [
          [
            "babel-plugin-import",
            {
              libraryName: "@mui/material",
              libraryDirectory: "",
              camel2DashComponentName: false,
            },
            "core",
          ],
          [
            "babel-plugin-import",
            {
              libraryName: "@mui/icons-material",
              libraryDirectory: "",
              camel2DashComponentName: false,
            },
            "icons",
          ],
        ],
      },
    }),
    tailwindcss(),
    svgr({
      svgrOptions: {
        // svgr options
      },
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {},
    },
  },
});
