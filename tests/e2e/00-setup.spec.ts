import { test, expect } from "@playwright/test";
import { ADMIN } from "./helpers";

test("first run redirects to setup, creates the admin account, and blocks a second setup", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByRole("heading", { name: "Welcome to Homi" })).toBeVisible();

  // Too-short password is rejected by the API even if the browser check is bypassed.
  const weak = await request.post("/api/setup", { data: { username: ADMIN.username, password: "short" } });
  expect(weak.status()).toBe(400);

  await page.getByLabel("Username").fill(ADMIN.username);
  await page.getByLabel(/^Password/).fill(ADMIN.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.context().storageState({ path: ".e2e-auth.json" });

  const again = await request.post("/api/setup", { data: { username: "second", password: "another-long-password" } });
  expect(again.status()).toBe(409);
});
