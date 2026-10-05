export class ApiClientError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string[]>) { super(message); }
}
export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiClientError(res.status, data?.error?.message ?? res.statusText, data?.error?.fields);
  return data as T;
}
