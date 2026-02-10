import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.spec.ts"],
    coverage: {
      enabled: false,
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/types/**/*.ts", "src/renderers/base-renderer.ts"],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 80,
        statements: 85
      }
    }
  }
});
