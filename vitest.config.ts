import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "scripts/server-only-stub.ts") } },
  test: { include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"] },
});
