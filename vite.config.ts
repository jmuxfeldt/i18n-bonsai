/// <reference types="vitest" />

import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

import { fileURLToPath, URL } from "url"
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  plugins: [
    {
      name: "vitest-plugin-beforeall",
      config: () => ({
        test: { setupFiles: ["./vitest/beforeall.ts"] },
      }),
    },
    vue(),
  ],
  define: { "process.env": {} },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Naive UI bundles date-fns v4; ensure its internal date-fns-tz uses v4 too
      "date-fns": path.resolve("./node_modules/naive-ui/node_modules/date-fns"),
    },
    extensions: [
      ".js",
      ".json",
      ".jsx",
      ".mjs",
      ".ts",
      ".tsx",
      ".vue",
      ".css",
      ".scss",
      ".sass",
    ],
  },
  optimizeDeps: {
    include: ["naive-ui"],
  },
  test: {
    globals: true,
    globalSetup: ["./vitest/setup.ts"],
    environment: "jsdom",
    deps: {},
  },
  server: {
    watch: {
      usePolling: true,
    },
    hmr: {
      host: 'localhost',
    },
    port: 3020,
  },
})
