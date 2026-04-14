import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@api": resolve(__dirname, "../api/src"),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./setup.ts"],
    testTimeout: 15_000,
    pool: "forks",
    env: {
      API_BASE_URL: "http://localhost:8787",
    },
  },
});
