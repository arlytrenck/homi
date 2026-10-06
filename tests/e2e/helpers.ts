import { expect, type Page } from "@playwright/test";

export const ADMIN = { username: "admin", password: "e2e-test-password-1" };

export async function openDashboard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

export async function enterEditMode(page: Page) {
  const done = page.getByRole("button", { name: "Done" });
  // After a reload the dashboard may still be loading; click() waits for the Edit button to appear.
  if (!(await done.isVisible())) await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(done).toBeVisible();
}

export async function addGroup(page: Page, name: string) {
  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByRole("textbox", { name: "Group name" }).fill(name);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

export async function addService(page: Page, o: { group?: string; name: string; url: string; monitor?: boolean }) {
  const section = o.group ? page.locator("section", { has: page.getByRole("heading", { name: o.group }) }) : page.locator("section", { has: page.getByRole("heading", { name: "Ungrouped" }) });
  await section.getByRole("button", { name: "Service" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Name", { exact: true }).fill(o.name);
  await dlg.getByLabel("URL", { exact: true }).fill(o.url);
  if (o.monitor === false) await dlg.getByLabel("Monitor this service").uncheck();
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(dlg).toBeHidden();
}
