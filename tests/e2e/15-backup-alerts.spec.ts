import { test, expect } from "@playwright/test";

test("YAML backup carries alert destinations (without URLs) and maintenance schedules", async ({ page }) => {
  const secret = "http://127.0.0.1:4999/health?token=super-secret-topic";
  expect((await page.request.put("/api/notifications", { data: { destinations: [{ kind: "ntfy", url: secret, enabled: true, onRecovery: true, groupIds: [], tags: ["critical"] }] } })).ok()).toBe(true);
  expect((await page.request.post("/api/maintenance/schedules", { data: { kind: "all", days: [0], startTime: "03:00", durationMin: 60, tz: "UTC", name: "Backup test window" } })).ok()).toBe(true);

  const yaml = await (await page.request.get("/api/config/export")).text();
  expect(yaml).toContain("alerts:");
  expect(yaml).toContain("Backup test window");
  expect(yaml).not.toContain("super-secret-topic");

  await page.goto("/settings");
  await page.getByLabel("Import YAML").fill(yaml);
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText(/Preview:.*maintenance schedules/)).toBeVisible();
  // Merge-importing our own export must not create duplicates.
  const r = await (await page.request.post("/api/config/import", { data: { yaml, mode: "merge", dryRun: false } })).json();
  expect(r).toMatchObject({ schedulesCreated: 0, destinationsAdded: 0 });
  const dests = (await (await page.request.get("/api/notifications")).json()).destinations;
  expect(dests).toHaveLength(1);
  expect(dests[0]).toMatchObject({ urlSet: true, enabled: true }); // the real destination kept its URL

  const sched = (await (await page.request.get("/api/maintenance")).json()).schedules;
  for (const s of sched) await page.request.delete(`/api/maintenance/schedules/${s.id}`);
  await page.request.put("/api/notifications", { data: { destinations: [] } });
});
