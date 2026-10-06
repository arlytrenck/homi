import { defineConfig } from "vitest/config";
import path from "node:path";
// Live-instance verification (not part of CI): pnpm verify:integrations
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "scripts/server-only-stub.ts") } },
  test: { include: ["tests/verify/*.verify.ts"], testTimeout: 120_000, hookTimeout: 30_000, reporters: ["verbose"] },
});
