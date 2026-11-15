// Tiny in-memory request cache: several screens need the same NASA pull
// (e.g. /api/replay), so fetch it once per session and share the promise.

const cache = new Map<string, Promise<unknown>>();

export function fetchJson<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then(async (r) => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error ?? `HTTP ${r.status}`);
      return body as T;
    });
    // Don't keep failures around — let the user retry.
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}
