import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/fixtures/**/*.test.ts"],
    exclude: [
      "node_modules/**",
      "dist/**",
      "tests/integration/**",
      "tests/e2e/**",
    ],
  },
});
