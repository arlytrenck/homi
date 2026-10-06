import { test, expect } from "@playwright/test";
import { ADMIN } from "./helpers";

const NEW = "e2e-new-password-2";

test("changing the password signs out other sessions and the old password stops working", async ({ page, browser, request }) => {
  test.setTimeout(90_000); // several argon2 hashes and sign-ins
  // A second session that should be revoked.
  const other = await browser.newContext({ baseURL: "http://127.0.0.1:3100", storageState: { cookies: [], origins: [] } });
  const op = await other.newPage();
  await op.goto("/login");
  await op.getByLabel("Username").fill(ADMIN.username);
  await op.getByLabel("Password").fill(ADMIN.password);
  await op.getByRole("button", { name: "Sign in" }).click();
  await expect(op).toHaveURL(/\/$/);

  await page.goto("/settings");
  await page.getByLabel("Current password").fill("wrong-current");
  await page.getByLabel(/New password/).fill(NEW);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Current password is incorrect")).toBeVisible();

  await page.getByLabel("Current password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText(/Password changed/)).toBeVisible();

  // This session survives; the other one is revoked.
  expect((await request.get("/api/settings")).status()).toBe(200);
  expect((await other.request.get("/api/settings")).status()).toBe(401);
  await other.close();

  const fresh = await browser.newContext({ baseURL: "http://127.0.0.1:3100", storageState: { cookies: [], origins: [] } });
  const fp = await fresh.newPage();
  await fp.goto("/login");
  await fp.getByLabel("Username").fill(ADMIN.username);
  await fp.getByLabel("Password").fill(ADMIN.password);
  await fp.getByRole("button", { name: "Sign in" }).click();
  await expect(fp.locator("form").getByRole("alert")).toBeVisible();
  await fp.getByLabel("Password").fill(NEW);
  await fp.getByRole("button", { name: "Sign in" }).click();
  await expect(fp).toHaveURL(/\/$/);
  await fresh.close();
});
