import { test, expect } from "@playwright/test";

const svc = (name: string, dependsOnId?: string) => ({ name, url: "http://127.0.0.1:1", tags: [], hiddenPublic: false, dependsOnId, check: { type: "tcp", target: "127.0.0.1:1", intervalS: 10, timeoutMs: 1000, expectedStatus: "200-399", ignoreTls: false, enabled: true } });

test("a dependent of a down service is shown as affected, and both outages are logged", async ({ page }) => {
  const parent = await (await page.request.post("/api/services", { data: svc("E2E Parent") })).json();
  const child = await (await page.request.post("/api/services", { data: svc("E2E Child", parent.id) })).json();
  // Let the parent be confirmed down before the child fails.
  await expect.poll(async () => ((await (await page.request.get("/api/dashboard")).json()).services.find((s: { name: string }) => s.name === "E2E Parent")?.status.status), { timeout: 30_000 }).toBe("down");
  await page.request.patch(`/api/services/${child.id}`, { data: { check: svc("E2E Child").check } }); // re-run the child now

  await page.goto("/");
  const tile = page.getByRole("link", { name: /E2E Child/ });
  await expect(tile.getByText("Affected by E2E Parent")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /need attention.*\+\d+ affected/ })).toBeVisible();

  await page.goto("/incidents");
  await expect(page.getByRole("row", { name: /^E2E Parent/ })).toContainText("Ongoing");
  await expect(page.getByRole("row", { name: /^E2E Child/ })).toContainText("Affected by E2E Parent");

  expect((await page.request.patch(`/api/services/${parent.id}`, { data: { dependsOnId: child.id } })).status()).toBe(400); // loop
  for (const id of [child.id, parent.id]) await page.request.delete(`/api/services/${id}`);
});

test("dependency can be chosen in the service dialog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Edit Homi itself" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByLabel("Depends on (optional)")).toBeVisible();
  await expect(dlg.getByLabel("Depends on (optional)").locator("option", { hasText: "Homi itself" })).toHaveCount(0); // not itself
});
