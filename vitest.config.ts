import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    globals: true
  },
  resolve: {
    alias: {
      "@coralguard/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname
    }
  }
});
