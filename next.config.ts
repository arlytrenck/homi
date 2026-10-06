import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
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
