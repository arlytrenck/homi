import { test, expect } from "@playwright/test";

test("a maintenance window marks the tile and can be ended early", async ({ page }) => {
  await page.goto("/settings");
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Maintenance windows" }) });
  await panel.getByLabel("Covers").selectOption("service");
  await panel.getByLabel("Service", { exact: true }).selectOption({ label: "Homi itself" });
  await panel.getByRole("button", { name: "Start / schedule" }).click();
  await expect(panel.getByRole("status")).toHaveText("Scheduled");
  await expect(panel.getByText("Homi itself").first()).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Homi itself/ }).getByText("Maintenance")).toBeVisible();

  await page.goto("/settings");
  await panel.getByRole("button", { name: "End maintenance for Homi itself" }).click();
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Homi itself/ }).getByText("Maintenance")).toBeHidden();
});

test("an admin can hold alerts for a service from its detail dialog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Homi itself uptime details" }).click();
  const dlg = page.getByRole("dialog", { name: "Homi itself" });
  await dlg.getByRole("button", { name: "1 h" }).click();
  await expect(dlg.getByText("In maintenance (manage in Settings)")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/settings");
  await page.getByRole("button", { name: "End maintenance for Homi itself" }).click();
});
