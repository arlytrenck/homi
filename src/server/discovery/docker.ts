import "server-only";
import fs from "node:fs";
import { Agent, request } from "undici";
import { safeFetch } from "@/server/net/safeFetch";
import type { DockerContainer } from "./labels";

/** HOMI_DOCKER_HOST: unix:///path.sock or http(s)://host:port (e.g. a docker-socket-proxy). Defaults to the standard socket if mounted. */
export function dockerEndpoint(env = process.env): string | null {
  if (env.HOMI_DOCKER_HOST) return env.HOMI_DISCOVERY === "off" ? null : env.HOMI_DOCKER_HOST;
  if (env.HOMI_DISCOVERY === "off") return null;
  return fs.existsSync("/var/run/docker.sock") ? "unix:///var/run/docker.sock" : null;
}

/** Only ever issues a read-only GET to /containers/json. */
export async function listContainers(endpoint: string): Promise<DockerContainer[]> {
  const path = "/containers/json";
  if (endpoint.startsWith("unix://")) {
    const agent = new Agent({ connect: { socketPath: endpoint.slice(7) } });
    try {
      const r = await request(`http://docker${path}`, { dispatcher: agent, headersTimeout: 8000, bodyTimeout: 8000 });
      const text = await r.body.text();
      if (r.statusCode !== 200) throw new Error(`Docker API returned ${r.statusCode}`);
      return JSON.parse(text);
    } finally { await agent.close(); }
  }
  const r = await safeFetch(endpoint.replace(/\/+$/, "") + path, { timeoutMs: 8000 });
  if (r.status !== 200) throw new Error(`Docker API returned ${r.status}${r.status === 403 ? " (is CONTAINERS=1 set on the socket proxy?)" : ""}`);
  return r.json();
}
