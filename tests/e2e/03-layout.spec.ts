import { test, expect, type Page } from "@playwright/test";
import { addGroup, addService, enterEditMode, openDashboard } from "./helpers";

const names = (page: Page, group: string) =>
  page.locator("section", { has: page.getByRole("heading", { name: group, exact: true }) }).locator("li .font-medium").allInnerTexts();

test("reorder services with the keyboard and the order persists", async ({ page }) => {
  await openDashboard(page);
  await enterEditMode(page);
  await addGroup(page, "Order");
  await addService(page, { group: "Order", name: "Alpha", url: "http://127.0.0.1:4999/health", monitor: false });
  await addService(page, { group: "Order", name: "Beta", url: "http://127.0.0.1:4999/health", monitor: false });
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Order", exact: true }) });
  await expect(section.locator("li")).toHaveCount(2);
  await expect.poll(async () => (await names(page, "Order")).join()).toContain("Alpha");

  // Keyboard drag: focus Alpha's handle, lift with Space, move right, drop.
  const handle = page.getByRole("button", { name: "Drag Alpha" });
  await handle.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(250); // dnd-kit needs a frame to enter drag mode and to measure targets
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(250);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await names(page, "Order"))[0]).toBe("Beta");

  await page.reload();
  await expect.poll(async () => (await names(page, "Order"))[0]).toBe("Beta");
});

test("move a service to another group by dragging", async ({ page }) => {
  await openDashboard(page);
  await enterEditMode(page);
  await addGroup(page, "Target");
  const handle = page.getByRole("button", { name: "Drag Alpha" });
  const target = page.locator("section", { has: page.getByRole("heading", { name: "Target", exact: true }) }).locator("ul");
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(from!.x + 20, from!.y + 20, { steps: 4 });
  await page.mouse.move(to!.x + 30, to!.y + 8, { steps: 12 });
  await page.mouse.up();
  const section = page.locator("section", { has: page.getByRole("heading", { name: "Target", exact: true }) });
  await expect(section.getByText("Alpha")).toBeVisible();
  await page.reload();
  await expect(page.locator("section", { has: page.getByRole("heading", { name: "Target", exact: true }) }).getByText("Alpha")).toBeVisible();
});
