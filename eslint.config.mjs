import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  { ignores: [".next/**", "dist/**", "drizzle/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // All outbound requests must go through safeFetch (SSRF guard).
    files: ["src/server/**/*.ts", "src/plugins/**/*.ts"],
    ignores: ["src/server/net/**"],
    rules: { "no-restricted-globals": ["error", { name: "fetch", message: "Use safeFetch from @/server/net/safeFetch." }] },
  },
  { rules: { "@typescript-eslint/no-explicit-any": "off" } },
];
