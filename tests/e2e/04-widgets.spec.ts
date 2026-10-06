import { test, expect } from "@playwright/test";
import { enterEditMode, openDashboard } from "./helpers";

test("add a notes widget, see its text, edit it, delete it", async ({ page }) => {
  await openDashboard(page);
  await enterEditMode(page);
  await page.getByRole("button", { name: "Add widget" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Widget").selectOption({ label: "Notes (built-in)" });
  await dlg.getByLabel("Text").fill("Remember to rotate the backup drives");
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(dlg).toBeHidden();
  const card = page.getByRole("region", { name: "Notes" });
  await expect(card.getByText("Remember to rotate the backup drives")).toBeVisible();

  await page.getByRole("button", { name: "Edit Notes" }).click();
  await dlg.getByLabel("Text").fill("Updated note");
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("region", { name: "Notes" }).getByText("Updated note")).toBeVisible();

  await page.getByRole("button", { name: "Delete Notes" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("region", { name: "Notes" })).toBeHidden();
});

test("host stats widget shows meters; bookmarks widget renders safe links only", async ({ page }) => {
  await openDashboard(page);
  await enterEditMode(page);
  await page.getByRole("button", { name: "Add widget" }).click();
  await page.getByRole("dialog").getByLabel("Widget").selectOption({ label: "Host (built-in)" });
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  const host = page.getByRole("region", { name: "Host" });
  await expect(host.getByRole("meter", { name: /Memory/ })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Add widget" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Widget").selectOption({ label: "Bookmarks (built-in)" });
  await dlg.getByLabel(/One per line/).fill("Docs | https://example.com/docs\nEvil | javascript:alert(1)");
  await dlg.getByRole("button", { name: "Save" }).click();
  const links = page.getByRole("region", { name: "Bookmarks" });
  await expect(links.getByRole("link", { name: /Docs/ })).toHaveAttribute("href", "https://example.com/docs");
  await expect(links.getByText("Evil")).toBeHidden(); // non-http(s) URLs are dropped
});
