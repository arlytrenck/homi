import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Shared via globalThis: the custom server bundle and Next's route bundles load this module separately.
const g = globalThis as unknown as { __homiMaster?: Buffer };

export function loadMasterKey(dataDir: string): Buffer {
  if (g.__homiMaster) return g.__homiMaster;
  let b64 = process.env.HOMI_SECRET_KEY;
  const file = process.env.HOMI_SECRET_KEY_FILE;
  if (!b64 && file) b64 = fs.readFileSync(file, "utf8").trim();
  if (!b64) {
    const keyPath = path.join(dataDir, "secret.key");
    if (fs.existsSync(keyPath)) b64 = fs.readFileSync(keyPath, "utf8").trim();
    else {
      b64 = crypto.randomBytes(32).toString("base64");
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(keyPath, b64, { mode: 0o600 });
      console.warn(`[homi] Generated a new secret key at ${keyPath}. BACK IT UP: integration secrets cannot be recovered without it.`);
    }
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("HOMI_SECRET_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)");
  g.__homiMaster = key;
  return key;
}

export function resetMasterKeyForTests(k?: Buffer) {
  g.__homiMaster = k;
}

function subkey(purpose: string): Buffer {
  const master = g.__homiMaster ?? loadMasterKey(process.env.HOMI_DATA ?? "data");
  return Buffer.from(crypto.hkdfSync("sha256", master, Buffer.alloc(0), purpose, 32));
}

export interface Envelope { v: 1; kid: "k1"; n: string; ct: string; tag: string }

export function encryptSecrets(value: unknown, aad: string): string {
  const nonce = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", subkey("enc:v1"), nonce);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  const env: Envelope = { v: 1, kid: "k1", n: nonce.toString("base64"), ct: ct.toString("base64"), tag: c.getAuthTag().toString("base64") };
  return JSON.stringify(env);
}

export function decryptSecrets<T = Record<string, string>>(envelope: string, aad: string): T {
  const env = JSON.parse(envelope) as Envelope;
  const d = crypto.createDecipheriv("aes-256-gcm", subkey("enc:v1"), Buffer.from(env.n, "base64"));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(env.tag, "base64"));
  const pt = Buffer.concat([d.update(Buffer.from(env.ct, "base64")), d.final()]);
  return JSON.parse(pt.toString("utf8")) as T;
}

export function hmac(purpose: string, data: string): string {
  return crypto.createHmac("sha256", subkey(purpose)).update(data).digest("hex");
}
