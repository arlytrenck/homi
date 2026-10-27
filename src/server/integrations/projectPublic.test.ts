import { describe, expect, it } from "vitest";
import { projectPublic } from "./runtime";

const data = { stats: [{ label: "a", value: "1" }], meters: [{ label: "cpu", value: 0.5 }], rows: [{ primary: "host.lan", href: "http://host.lan" }], note: "internal" };

describe("projectPublic", () => {
  it("summary drops rows and notes", () => {
    const out = projectPublic(data, "summary");
    expect(out).toEqual({ stats: data.stats, meters: data.meters });
  });
  it("full keeps everything", () => expect(projectPublic(data, "full")).toBe(data));
});
