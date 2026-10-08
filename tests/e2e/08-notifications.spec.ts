import { test, expect } from "@playwright/test";
import { enterEditMode, openDashboard } from "./helpers";

test("alerts can be tested and saved; the URL is never shown back", async ({ page }) => {
  await page.goto("/settings");
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Alerts" }) });
  await panel.getByLabel("URL").fill("http://127.0.0.1:4999/health");
  await panel.getByRole("button", { name: "Send test" }).click();
  await expect(panel.getByText("Test sent")).toBeVisible();
  await panel.getByLabel("Send alerts").check();
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(panel.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(panel.getByLabel(/URL/)).toHaveValue("");
  await expect(panel.getByText("saved — leave blank to keep")).toBeVisible();
  await expect(panel.getByLabel("Send alerts")).toBeChecked();
});

test("alerts reject metadata addresses", async ({ page }) => {
  await page.goto("/settings");
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Alerts" }) });
  await panel.getByLabel(/URL/).fill("http://169.254.169.254/latest");
  await panel.getByRole("button", { name: "Send test" }).click();
  await expect(panel.getByText(/Failed: .*Blocked/)).toBeVisible();
});

test("a service can be muted and shows it on its tile", async ({ page }) => {
  await openDashboard(page);
  await enterEditMode(page);
  await page.getByRole("button", { name: "Edit Homi itself" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Mute down/recovery alerts for this service").check();
  await dlg.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("link", { name: /Homi itself/ }).getByLabel("Alerts muted")).toBeVisible();
});
