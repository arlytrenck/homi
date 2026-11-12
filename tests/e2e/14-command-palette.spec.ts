import { test, expect } from "@playwright/test";

test("Cmd/Ctrl+K opens the palette; typing filters; Enter runs the action", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("ControlOrMeta+k");
  const dlg = page.getByRole("dialog", { name: "Command palette" });
  const box = dlg.getByRole("combobox");
  await expect(box).toBeFocused();
  await expect(dlg.getByRole("option", { name: /Homi itself/ })).toBeVisible();

  await box.fill("incid");
  await expect(dlg.getByRole("option")).toHaveCount(1);
  await box.press("Enter");
  await expect(page).toHaveURL(/\/incidents$/);
  await expect(dlg).toBeHidden();
});

test("arrow keys move the selection; the theme action flips the theme; Escape closes", async ({ page }) => {
  await page.goto("/ops");
  const before = await page.evaluate(() => document.documentElement.dataset.theme ?? "");
  await page.keyboard.press("ControlOrMeta+k");
  const dlg = page.getByRole("dialog", { name: "Command palette" });
  await dlg.getByRole("combobox").fill("theme");
  await expect(dlg.getByRole("option", { selected: true })).toContainText("Toggle light / dark theme");
  await dlg.getByRole("combobox").press("Enter");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme ?? "")).not.toBe(before);
  await page.request.patch("/api/settings", { data: { theme: "system" } });

  await page.keyboard.press("ControlOrMeta+k");
  await expect(dlg).toBeVisible();
  await dlg.getByRole("combobox").press("ArrowDown");
  await expect(dlg.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();
});
