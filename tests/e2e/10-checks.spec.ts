import { test, expect } from "@playwright/test";

const heartbeat = { name: "Nightly backup", url: "http://127.0.0.1:4999/health", tags: [], hiddenPublic: false, check: { type: "heartbeat", target: "heartbeat", intervalS: 3600, timeoutMs: 5000, expectedStatus: "200-399", ignoreTls: false, enabled: true } };

async function dash(page: import("@playwright/test").Page) {
  const d = await (await page.request.get("/api/dashboard")).json();
  return d.services.find((s: { name: string }) => s.name === "Nightly backup");
}

test("heartbeat check: push URL, ping marks it up, /fail marks it down, bad token is 404", async ({ page }) => {
  expect((await page.request.post("/api/services", { data: heartbeat })).ok()).toBe(true);
  let svc = await dash(page);
  expect(svc.status.type).toBe("heartbeat");
  expect(svc.status.status).toBe("unknown"); // waits for the first ping
  const token = svc.status.token as string;
  expect(token.length).toBeGreaterThan(16);

  expect((await page.request.get(`/api/heartbeat/${token}`)).ok()).toBe(true);
  svc = await dash(page);
  expect(svc.status.status).toBe("up");

  expect((await page.request.post(`/api/heartbeat/${token}/fail?msg=exit%201`)).ok()).toBe(true);
  svc = await dash(page);
  expect(svc.status.status).toBe("down");

  expect((await page.request.get(`/api/heartbeat/${token}`)).ok()).toBe(true);
  expect((await dash(page)).status.status).toBe("up");
  expect((await page.request.get("/api/heartbeat/not-a-real-token")).status()).toBe(404);
});

test("the push URL is shown in the service dialog and never to the public", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Edit Nightly backup" }).click();
  await expect(page.getByTestId("heartbeat-url")).toContainText("/api/heartbeat/");
  const anon = await browser.newContext({ baseURL: `http://127.0.0.1:${process.env.E2E_PORT ?? 3100}`, storageState: { cookies: [], origins: [] } });
  const r = await anon.request.get("/api/dashboard");
  expect(await r.text()).not.toContain("heartbeat/");
  await anon.close();
});

test("the TLS expiry type is offered and tests against a plain-HTTP target with a clear error", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Edit Nightly backup" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Check type").selectOption("tls");
  await dlg.getByLabel(/Host\[:port\]/).fill("127.0.0.1:4999");
  await dlg.getByRole("button", { name: "Test" }).click();
  await expect(dlg.getByText(/Failed:/)).toBeVisible({ timeout: 10_000 });
});
