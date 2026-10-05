import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";
import { encryptSecrets, decryptSecrets, resetMasterKeyForTests } from "./secretbox";

beforeAll(() => resetMasterKeyForTests(crypto.randomBytes(32)));

describe("secretbox", () => {
  it("round-trips", () => {
    const env = encryptSecrets({ apiKey: "abc" }, "id1:pihole");
    expect(env).not.toContain("abc");
    expect(decryptSecrets(env, "id1:pihole")).toEqual({ apiKey: "abc" });
  });
  it("fails on wrong AAD", () => {
    const env = encryptSecrets({ a: "b" }, "id1:x");
    expect(() => decryptSecrets(env, "id2:x")).toThrow();
  });
  it("fails on tampering", () => {
    const e = JSON.parse(encryptSecrets({ a: "b" }, "x"));
    e.ct = Buffer.from("zzzzzzzz").toString("base64");
    expect(() => decryptSecrets(JSON.stringify(e), "x")).toThrow();
  });
});
