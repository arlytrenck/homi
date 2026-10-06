import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ADMIN } from "./helpers";

test.use({ storageState: { cookies: [], origins: [] } }); // anonymous

test("anonymous visitors are sent to sign-in and API calls are rejected", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.get("/api/dashboard")).status()).toBe(401);
  expect((await request.post("/api/groups", { data: { name: "x" } })).status()).toBe(401);
  expect((await request.get("/api/settings")).status()).toBe(401);
});

test("wrong password shows an error, correct password signs in, sign-out returns to login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(ADMIN.username);
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Invalid username or password"); // not Next's route announcer

  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("cross-origin writes are rejected even with a valid session", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(ADMIN.username);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  const res = await page.request.post("/api/groups", { data: { name: "evil" }, headers: { origin: "http://evil.example" } });
  expect(res.status()).toBe(403);
});

test("login page has no serious accessibility violations", async ({ page }) => {
  await page.goto("/login");
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"), JSON.stringify(r.violations.map((v) => v.id))).toEqual([]);
});
