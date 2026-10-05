import { defineConfig } from "tsup";

// Only CLI scripts are bundled here. Native modules stay external: they are
// traced into .next/standalone/node_modules, where dist/ scripts resolve them.
export default defineConfig({
  entry: { "scripts/reset-password": "scripts/reset-password.ts" },
  outDir: "dist", format: ["esm"], target: "node22", platform: "node", clean: true,
  external: [/^(better-sqlite3|@node-rs\/argon2)$/],
  noExternal: [/^(?!better-sqlite3$|@node-rs\/argon2$)[^.\/].*/, /^@\//],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  esbuildOptions(o) { o.alias = { "@": "./src", "server-only": "./scripts/server-only-stub.ts" }; },
});
