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
  await expect(panel.getByRole("status").last()).toHaveText("Saved");
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

test("a second destination can be added, saved and removed", async ({ page }) => {
  await page.goto("/settings");
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Alerts" }) });
  await panel.getByRole("button", { name: "Add destination" }).click();
  const second = panel.locator("fieldset").nth(1);
  await second.getByLabel("Type").selectOption("ntfy");
  await second.getByLabel("URL").fill("http://127.0.0.1:4999/health");
  await second.getByRole("button", { name: "Send test" }).click();
  await expect(second.getByRole("status")).toHaveText("Test sent");
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await expect(panel.getByRole("status").last()).toHaveText("Saved");
  await page.reload();
  await expect(panel.locator("fieldset")).toHaveCount(2);
  await expect(panel.locator("fieldset").nth(1).getByLabel("Type")).toHaveValue("ntfy");
  await panel.getByRole("button", { name: "Remove destination 2" }).click();
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(panel.locator("fieldset")).toHaveCount(1);
});

test("a destination can be limited to selected groups", async ({ page }) => {
  await page.goto("/settings");
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Alerts" }) });
  const row = panel.locator("fieldset").first();
  await row.getByLabel("Alert for").selectOption("groups");
  await expect(row.getByText("No group or tag selected")).toBeVisible();
  await row.getByRole("group").getByLabel("Infrastructure").check();
  await expect(row.getByText("No group or tag selected")).toBeHidden();
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await expect(panel.getByRole("status").last()).toHaveText("Saved");
  await page.reload();
  const again = panel.locator("fieldset").first();
  await expect(again.getByLabel("Alert for")).toHaveValue("groups");
  await expect(again.getByRole("group").getByLabel("Infrastructure")).toBeChecked();
  await again.getByLabel("Alert for").selectOption("all");
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await expect(panel.getByRole("status").last()).toHaveText("Saved");
});

test("tags can be set on a service and used to route alerts", async ({ page }) => {
  await openDashboard(page);
  await enterEditMode(page);
  await page.getByRole("button", { name: "Edit Homi itself" }).click();
  await page.getByRole("dialog").getByLabel("Tags").fill("critical, edge");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await page.goto("/settings");
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Alerts" }) });
  const row = panel.locator("fieldset").first();
  await row.getByLabel("Alert for").selectOption("groups");
  await row.getByLabel("Tags (comma-separated)").fill("critical");
  await expect(row.getByText("No group or tag selected")).toBeHidden();
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await expect(panel.getByRole("status").last()).toHaveText("Saved");
  await page.reload();
  await expect(panel.locator("fieldset").first().getByLabel("Tags (comma-separated)")).toHaveValue("critical");
  await panel.locator("fieldset").first().getByLabel("Alert for").selectOption("all");
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await expect(panel.getByRole("status").last()).toHaveText("Saved");
});

test("quiet hours can be set per destination and survive a reload", async ({ page }) => {
  await page.goto("/settings");
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Alerts" }) });
  const row = () => panel.locator("fieldset").first();
  const save = async () => { await panel.getByRole("button", { name: "Save", exact: true }).click(); };
  await row().getByLabel(/Quiet hours/).check();
  await row().getByLabel("From").fill("23:00");
  await row().getByLabel("Until").fill("06:30");
  await row().getByLabel("Time zone").fill("Mars/Olympus");
  await save();
  await expect(panel.getByText(/Unknown time zone/)).toBeVisible();
  await row().getByLabel("Time zone").fill("Europe/Berlin");
  await save();
  await expect(panel.getByRole("status").last()).toHaveText("Saved");
  await page.reload();
  await expect(row().getByLabel("From")).toHaveValue("23:00");
  await expect(row().getByLabel("Until")).toHaveValue("06:30");
  await expect(row().getByLabel("Time zone")).toHaveValue("Europe/Berlin");
  await row().getByLabel(/Quiet hours/).uncheck();
  await save();
  await expect(panel.getByRole("status").last()).toHaveText("Saved");
});
