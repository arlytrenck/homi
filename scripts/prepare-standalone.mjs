// Make .next/standalone self-contained so it can be run (or copied into an image) as-is.
import fs from "node:fs";
const out = ".next/standalone";
fs.cpSync(".next/static", `${out}/.next/static`, { recursive: true });
if (fs.existsSync("public")) fs.cpSync("public", `${out}/public`, { recursive: true });
fs.cpSync("drizzle", `${out}/drizzle`, { recursive: true });
fs.cpSync("dist", `${out}/dist`, { recursive: true });
console.log("standalone prepared");
