import { test, expect } from "@playwright/test";
import { enterEditMode, openDashboard } from "./helpers";

const KEY = "e2e-sonarr-key";

test("connect Sonarr from settings: bad key fails, good key connects, secret is never shown again", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Integration type").selectOption("Sonarr");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel(/Base URL/).fill("http://127.0.0.1:4999");

  await dlg.getByLabel(/API key/).fill("wrong-key");
  await dlg.getByRole("button", { name: "Test connection" }).click();
  await expect(dlg.getByRole("status")).toContainText(/Authentication failed/);

  await dlg.getByLabel(/API key/).fill(KEY);
  await dlg.getByRole("button", { name: "Test connection" }).click();
  await expect(dlg.getByRole("status")).toContainText("Connected (4.0.9)");
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(dlg).toBeHidden();
  await expect(page.getByText("http://127.0.0.1:4999", { exact: false })).toBeVisible();

  // Reopen: the secret is masked and its value is nowhere in the page.
  await page.getByRole("button", { name: "Edit Sonarr" }).click();
  await expect(dlg.getByLabel(/API key/)).toHaveAttribute("placeholder", /saved/);
  await expect(dlg.getByLabel(/API key/)).toHaveValue("");
  expect(await page.content()).not.toContain(KEY);
  await dlg.getByRole("button", { name: "Cancel" }).click();
});

test("a Sonarr widget shows live numbers from the integration", async ({ page }) => {
  await openDashboard(page);
  await enterEditMode(page);
  await page.getByRole("button", { name: "Add widget" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Widget").selectOption({ label: "Sonarr: Sonarr" });
  await dlg.getByRole("button", { name: "Save" }).click();
  const card = page.getByRole("region", { name: "Sonarr" });
  await expect(card.getByText("Queue")).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText("4", { exact: true })).toBeVisible();
  await expect(card.getByText("9", { exact: true })).toBeVisible();
});

test("integration secrets are encrypted at rest and absent from every API response", async ({ request }) => {
  const list = await (await request.get("/api/integrations")).text();
  const dash = await (await request.get("/api/dashboard")).text();
  expect(list).not.toContain(KEY);
  expect(dash).not.toContain(KEY);
  expect(JSON.parse(list).integrations[0].secrets).toEqual({ apiKey: { set: true } });
});
