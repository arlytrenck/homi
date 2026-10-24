import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
    ] }];
  },
  serverExternalPackages: ["better-sqlite3", "@node-rs/argon2"],
  webpack(cfg, { nextRuntime }) {
    // The boot hook is also compiled for the edge runtime in dev, where its Node-only branch is dead code.
    // Externalize Node-only modules there so the unreachable imports don't fail the build.
    if (nextRuntime === "edge") {
      cfg.externals = [...(cfg.externals ?? []), /^node:/, "better-sqlite3", "@node-rs/argon2", "undici", "fs", "path", "net", "dns", "child_process", "os"];
    }
    return cfg;
  },
};
export default config;
