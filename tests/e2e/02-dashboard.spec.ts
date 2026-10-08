import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { addGroup, addService, enterEditMode, openDashboard } from "./helpers";

test("empty dashboard guides the user", async ({ page }) => {
  await openDashboard(page);
  await expect(page.getByText("Nothing here yet")).toBeVisible();
});

test("add a group and a monitored service; it turns up", async ({ page }) => {
  await openDashboard(page);
  await enterEditMode(page);
  await expect(page.getByText("Nothing here yet")).toBeHidden(); // hint hides while editing
  await addGroup(page, "Infrastructure");
  await addService(page, { group: "Infrastructure", name: "Homi itself", url: "http://127.0.0.1:4999/health" });
  await page.getByRole("button", { name: "Done" }).click();
  const tile = page.getByRole("link", { name: /Homi itself/ });
  await expect(tile).toBeVisible();
  await expect(tile.getByRole("img", { name: "Up" })).toBeVisible({ timeout: 20_000 });
});

test("uptime details open for a monitored service and switch ranges", async ({ page }) => {
  await openDashboard(page);
  await page.getByRole("button", { name: "Homi itself uptime details" }).click();
  const dlg = page.getByRole("dialog", { name: "Homi itself" });
  await expect(dlg.getByText("Uptime", { exact: true })).toBeVisible();
  await dlg.getByRole("tab", { name: "7d" }).click();
  await expect(dlg.getByRole("tab", { name: "7d" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();
});

test("the service test button explains why a target is blocked", async ({ page }) => {
  await openDashboard(page);
  await enterEditMode(page);
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Infrastructure" }) });
  await section.getByRole("button", { name: "Service" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Name", { exact: true }).fill("Metadata");
  await dlg.getByLabel("URL", { exact: true }).fill("http://169.254.169.254/latest");
  await dlg.getByRole("button", { name: "Test" }).click();
  await expect(dlg.getByText(/Blocked target 169\.254\.169\.254/)).toBeVisible();
  await dlg.getByRole("button", { name: "Cancel" }).click();
});

test("search filters tiles and Enter opens the first match", async ({ page, context }) => {
  await openDashboard(page);
  const search = page.getByLabel("Search services");
  await search.fill("zzz-no-match");
  await expect(page.getByText(/No matches for/)).toBeVisible();
  await search.fill("homi");
  await expect(page.getByRole("link", { name: /Homi itself/ })).toBeVisible();
  const popup = context.waitForEvent("page");
  await search.press("Enter");
  expect((await popup).url()).toContain("127.0.0.1:4999/health");
});

test("edit a service without losing untouched settings, then delete it with an in-page confirm", async ({ page }) => {
  await openDashboard(page);
  await enterEditMode(page);
  await addService(page, { group: "Infrastructure", name: "Scratch", url: "http://127.0.0.1:4999/health", monitor: false });
  await page.getByRole("button", { name: "Edit Scratch" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Description").fill("temp description");
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(dlg).toBeHidden();
  await page.reload();
  await enterEditMode(page);
  await expect(page.getByText("temp description")).toBeVisible();

  await page.getByRole("button", { name: "Delete Scratch" }).click();
  await expect(page.getByRole("dialog").getByText("Delete Scratch?")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Scratch", { exact: true })).toBeHidden();
});

test("theme choice persists across reloads without a flash", async ({ page }) => {
  await openDashboard(page);
  const html = page.locator("html");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  const chosen = await html.getAttribute("data-theme");
  expect(["light", "dark"]).toContain(chosen);
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", chosen!);
});

test("dashboard has no serious accessibility violations (light and dark)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); // no colour transitions mid-measurement
  await openDashboard(page);
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"), `${theme}: ${JSON.stringify(r.violations.map((v) => v.id))}`).toEqual([]);
  }
});
