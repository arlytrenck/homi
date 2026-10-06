import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { enterEditMode, openDashboard } from "./helpers";

const FLAG = "/tmp/homi-e2e-docker-on";
test.afterAll(() => { try { fs.unlinkSync(FLAG); } catch { /* ignore */ } });

test("labeled containers appear after a sync, with invalid labels reported", async ({ page }) => {
  fs.writeFileSync(FLAG, "1"); // fake Docker daemon starts reporting containers
  await page.goto("/settings");
  const panel = page.getByRole("region", { name: "Docker discovery" });
  await expect(panel.getByText(/Connected to/)).toBeVisible();
  await panel.getByRole("button", { name: "Sync now" }).click();
  await expect(panel.getByText("Plex")).toBeVisible();
  await expect(panel.getByText("broken", { exact: false })).toBeVisible();
  await expect(panel.getByText(/Unknown homi\.check/)).toBeVisible();

  await openDashboard(page);
  const media = page.locator("section", { has: page.getByRole("heading", { name: "Media", exact: true }) });
  const tile = media.getByRole("link", { name: /Plex/ });
  await expect(tile).toBeVisible();
  await expect(tile.getByRole("img", { name: "Managed by Docker labels" })).toBeVisible();
  await expect(tile.getByRole("img", { name: "Up" })).toBeVisible({ timeout: 20_000 });
});

test("label-managed services are read-only and cannot be deleted from the UI", async ({ page, request }) => {
  await openDashboard(page);
  await enterEditMode(page);
  await expect(page.getByRole("button", { name: "Delete Plex" })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit Plex" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByText(/Managed by Docker labels/)).toBeVisible();
  await expect(dlg.getByLabel("Name", { exact: true })).toHaveAttribute("readonly", "");
  await dlg.getByRole("button", { name: "Cancel" }).click();

  const dash = await (await request.get("/api/dashboard")).json();
  const id = dash.services.find((s: { name: string }) => s.name === "Plex").id;
  expect((await request.patch(`/api/services/${id}`, { data: { name: "Renamed" } })).status()).toBe(409);
  expect((await request.delete(`/api/services/${id}`)).status()).toBe(409);
});

test("a container that disappears is marked not running", async ({ page }) => {
  fs.unlinkSync(FLAG);
  await page.goto("/settings");
  await page.getByRole("region", { name: "Docker discovery" }).getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByRole("region", { name: "Docker discovery" }).getByText("not running")).toBeVisible();
  await openDashboard(page);
  await expect(page.getByText("Container not running")).toBeVisible();
});
