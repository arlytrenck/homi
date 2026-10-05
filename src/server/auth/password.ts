import "server-only";
import { hash, verify } from "@node-rs/argon2";

const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1, algorithm: 2 as const };
export const hashPassword = (pw: string) => hash(pw, OPTS);
export const verifyPassword = (h: string, pw: string) => verify(h, pw).catch(() => false);
