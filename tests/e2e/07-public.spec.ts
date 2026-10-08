import { test, expect, type Browser } from "@playwright/test";
import { addService, enterEditMode, openDashboard } from "./helpers";

async function anonymous(browser: Browser) {
  return browser.newContext({ baseURL: `http://127.0.0.1:${process.env.E2E_PORT ?? 3100}`, storageState: { cookies: [], origins: [] } });
}

test("public view exposes only what you allow, read-only", async ({ page, browser }) => {
  // A private service and a public one.
  await openDashboard(page);
  await enterEditMode(page);
  await addService(page, { name: "Visible to all", url: "http://127.0.0.1:4999/health", monitor: false });
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Ungrouped" }) });
  await section.getByRole("button", { name: "Service" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Name", { exact: true }).fill("Private box");
  await dlg.getByLabel("URL", { exact: true }).fill("http://127.0.0.1:4999/health");
  await dlg.getByLabel("Monitor this service").uncheck();
  await dlg.getByLabel("Hide from public view").check();
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(dlg).toBeHidden();

  // Off by default: anonymous visitors get the login page.
  let anon = await anonymous(browser);
  let ap = await anon.newPage();
  await ap.goto("/");
  await expect(ap).toHaveURL(/\/login$/);
  await anon.close();

  await page.goto("/settings");
  await page.getByLabel(/Public read-only view/).click();
  await expect(page.getByLabel(/Public read-only view/)).toBeChecked();

  anon = await anonymous(browser);
  ap = await anon.newPage();
  await ap.goto("/");
  await expect(ap.getByRole("link", { name: /Visible to all/ })).toBeVisible();
  await expect(ap.getByText("Private box")).toBeHidden();
  await expect(ap.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  await expect(ap.getByRole("link", { name: "Sign in" })).toBeVisible();
  // Never exposed to the public: settings, writes, widget data hidden from public view.
  expect((await ap.request.get("/api/settings")).status()).toBe(401);
  expect((await ap.request.post("/api/groups", { data: { name: "x" } })).status()).toBe(401);
  const dash = await (await ap.request.get("/api/dashboard")).text();
  expect(dash).not.toContain("Private box");
  expect(dash).not.toContain("127.0.0.1:4999/health\",\"intervalS"); // no check internals
  await anon.close();

  // Turn it off again: anonymous access is closed.
  await page.goto("/settings");
  await page.getByLabel(/Public read-only view/).click();
  await expect(page.getByLabel(/Public read-only view/)).not.toBeChecked();
  anon = await anonymous(browser);
  ap = await anon.newPage();
  await ap.goto("/");
  await expect(ap).toHaveURL(/\/login$/);
  await anon.close();
});
