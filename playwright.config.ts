import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const dataDir = path.resolve(".e2e-data");
const dockerSock = "/tmp/homi-e2e-docker.sock";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // one shared server and database; specs run in file order
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "setup", testMatch: /00-setup\.spec\.ts/ },
    { name: "app", testMatch: /^(?!.*00-setup).*\.spec\.ts$/, dependencies: ["setup"], use: { ...devices["Desktop Chrome"], storageState: ".e2e-auth.json" } },
  ],
  webServer: [
    { command: "node tests/e2e/mocks.mjs", url: "http://127.0.0.1:4999/health", reuseExistingServer: false, timeout: 15_000 },
    {
      // Runs the production standalone build, exactly as the Docker image does.
      command: `rm -rf "${dataDir}" && mkdir -p "${dataDir}" && node .next/standalone/server.js`,
      url: `http://127.0.0.1:${PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: "production", PORT: String(PORT), HOSTNAME: "127.0.0.1", HOMI_DATA: dataDir,
        HOMI_ALLOW_LOOPBACK: "1", HOMI_DOCKER_HOST: `unix://${dockerSock}`, HOMI_DISCOVERY_HOST: "nas.lan",
      },
    },
  ],
});
