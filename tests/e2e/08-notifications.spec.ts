import { test, expect } from "@playwright/test";

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
