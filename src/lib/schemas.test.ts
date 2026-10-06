import { describe, it, expect } from "vitest";
import { IntegrationInput, IntegrationPatch, ServiceInput, ServicePatch, WidgetInput, WidgetPatch } from "./schemas";

// Regression: zod's .partial() keeps .default(), which silently reset untouched fields on every PATCH.
describe("patch schemas do not inject defaults", () => {
  it("service", () => { expect(ServicePatch.parse({ groupId: null })).toEqual({ groupId: null }); });
  it("integration", () => { expect(IntegrationPatch.parse({ name: "x" })).toEqual({ name: "x" }); });
  it("widget", () => { expect(WidgetPatch.parse({ title: "t" })).toEqual({ title: "t" }); });
  it("create schemas still apply defaults", () => {
    expect(ServiceInput.parse({ name: "a", url: "http://a" })).toMatchObject({ targetBlank: true, tags: [], hiddenPublic: false });
    expect(IntegrationInput.parse({ type: "x", name: "a", baseUrl: "http://a" })).toMatchObject({ config: {}, secrets: {}, ignoreTls: false, enabled: true });
    expect(WidgetInput.parse({ kind: "core.notes" })).toMatchObject({ options: {}, area: "main", size: "md", hiddenPublic: true });
  });
  it("patch still validates provided fields", () => {
    expect(() => ServicePatch.parse({ url: "ftp://x" })).toThrow();
  });
});
