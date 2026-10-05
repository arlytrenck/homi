import { describe, it, expect } from "vitest";
import { plugins, widgetRegistry } from "./registry";

describe("plugin registry", () => {
  it("has unique plugin and widget ids", () => {
    expect(new Set(plugins.map((p) => p.id)).size).toBe(plugins.length);
    const all = [...plugins.flatMap((p) => p.widgets.map((w) => w.id)), ...Object.keys(widgetRegistry).filter((k) => k.startsWith("core."))];
    expect(new Set(all).size).toBe(all.length);
  });
  it("namespaces widget ids with their plugin id", () => {
    for (const p of plugins) for (const w of p.widgets) expect(w.id.startsWith(`${p.id}.`)).toBe(true);
  });
  it("every secret field is declared as kind=secret and every plugin has a widget", () => {
    for (const p of plugins) {
      expect(p.widgets.length).toBeGreaterThan(0);
      for (const f of Object.values(p.secrets)) expect(f.kind).toBe("secret");
    }
  });
});
