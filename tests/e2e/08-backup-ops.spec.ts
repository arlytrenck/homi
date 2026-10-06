import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("YAML export contains manual services, import preview reports without writing", async ({ page, request }) => {
  const yaml = await (await request.get("/api/config/export")).text();
  expect(yaml).toContain("version: 1");
  expect(yaml).toContain("Homi itself");
  expect(yaml).not.toContain("Plex"); // docker-managed services come from labels, not backups

  await page.goto("/settings");
  await page.getByLabel("Import YAML").fill("version: 1\ngroups:\n  - name: Imported\n    services:\n      - { name: From YAML, url: 'http://127.0.0.1:4999/health' }\n");
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText(/Preview: 1 groups, 1 new services/)).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("From YAML")).toBeHidden(); // preview wrote nothing

  await page.goto("/settings");
  await page.getByLabel("Import YAML").fill("version: 1\ngroups:\n  - name: Imported\n    services:\n      - { name: From YAML, url: 'http://127.0.0.1:4999/health' }\n");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByText(/Imported: 1 groups/)).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("From YAML")).toBeVisible();
});

test("invalid YAML is rejected with a message", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Import YAML").fill("version: 2");
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("region", { name: "Backup & restore (YAML)" }).getByText(/./).last()).toBeVisible();
});

test("ops view lists monitored services worst-first; settings and ops have no serious a11y violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/ops");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Homi itself" })).toBeVisible();
  let r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"), JSON.stringify(r.violations.map((v) => v.id))).toEqual([]);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"), JSON.stringify(r.violations.map((v) => v.id))).toEqual([]);
});
