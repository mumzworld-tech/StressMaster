import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Default test configuration - includes all tests in new structure
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
