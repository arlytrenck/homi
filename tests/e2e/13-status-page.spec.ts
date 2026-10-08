import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const base = () => `http://127.0.0.1:${process.env.E2E_PORT ?? 3100}`;

test("the status page is off by default, public once enabled, and never shows hidden services", async ({ page, browser }) => {
  const anon = await browser.newContext({ baseURL: base(), storageState: { cookies: [], origins: [] } });
  expect((await anon.request.get("/api/status")).status()).toBe(404);
  expect((await (await anon.newPage()).goto("/status"))!.status()).toBe(404);

  await page.request.post("/api/services", { data: { name: "Hidden thing", url: "http://127.0.0.1:4999/health", tags: [], hiddenPublic: true, check: { type: "http", target: "http://127.0.0.1:4999/health", intervalS: 60, timeoutMs: 5000, expectedStatus: "200-399", ignoreTls: false, enabled: true } } });
  expect((await page.request.patch("/api/settings", { data: { statusPage: true } })).ok()).toBe(true);

  const pub = await anon.newPage();
  await pub.goto("/status");
  await expect(pub.getByRole("heading", { name: /status/i })).toBeVisible();
  await expect(pub.getByRole("status").first()).toContainText(/operational|down|degraded|outage|maintenance/i);
  await expect(pub.getByText("Homi itself")).toBeVisible();
  await expect(pub.getByRole("img", { name: "Homi itself: 90-day uptime history" })).toBeVisible();
  await expect(pub.getByText("Hidden thing")).toHaveCount(0);
  const serious = (await new AxeBuilder({ page: pub }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 90) + " " + (n.any[0]?.message ?? "")).join(" | ")}`)).toEqual([]);
  expect(await (await anon.request.get("/api/status")).text()).not.toContain("Hidden thing");

  await page.request.patch("/api/settings", { data: { statusPage: false } });
  expect((await anon.request.get("/api/status")).status()).toBe(404);
  await anon.close();
});

test("the setting is available in Settings", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByLabel(/Public status page/)).toBeVisible();
});

test("the incidents page has no serious accessibility violations", async ({ page }) => {
  await page.goto("/incidents");
  await expect(page.getByRole("heading", { name: "Incidents" })).toBeVisible();
  const serious = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => v.id)).toEqual([]);
});
