import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Default test configuration - includes all tests in new structure
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "tests/",
        "*.config.ts",
        "*.d.ts",
        "src/cli.ts", // CLI entry point, minimal logic
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
