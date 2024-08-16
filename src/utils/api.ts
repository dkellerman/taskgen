import { v4 as uuid } from "uuid";

export async function apiFetch<T>(url: string, opts: any = {}): Promise<any> {
  const token = getToken();
  const resp = await fetch(`/api/${url}`, {
    headers: {
      ...opts.headers,
      "Content-Type": "application/json",
      "x-tz": Intl.DateTimeFormat().resolvedOptions().timeZone,
      Authorization: token ? `Bearer ${token}` : undefined,
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!resp.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${resp.status} ${resp.statusText}`
    );
  }

  return (await resp.json()) as T;
}

export async function apiStream(
  url: string,
  opts: any = {},
  cb: {
    onChunk?: (chunk: string) => Promise<void>;
  } = {}
): Promise<any> {
  const token = getToken();
  const resp = await fetch(`/api/${url}`, {
    headers: {
      ...opts.headers,
      "Content-Type": "application/json",
      "x-tz": Intl.DateTimeFormat().resolvedOptions().timeZone,
      Authorization: token ? `Bearer ${token}` : undefined,
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!resp.ok) {
    throw new Error(
      `Failed to stream ${url}: ${resp.status} ${resp.statusText}`
    );
  }

  const reader = resp.body?.getReader();
  if (!reader) throw new Error("Failed to get reader");
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    await cb.onChunk?.(chunk);
  }
}

function getToken() {
  return localStorage.getItem("gu") || uuid() + "-gx7";
}
