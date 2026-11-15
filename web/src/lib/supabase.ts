import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client (secret key — never import this from a client
// component). Returns null when env vars are missing, so the app still runs
// without a database (everything falls back to live NASA calls).

let client: SupabaseClient | null | undefined;

export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

export type CacheOpts = {
  /** Cell size in degrees. 0.1 (~11 km, default) suits NASA POWER (0.5° grid); use 0.001 (~100 m)
   *  for 250 m products (SoilGrids, MODIS) so neighbouring farms never share a result. */
  cell?: number;
  /** If the source fails, return the last cached payload even if expired (this cell, else the nearest cell
   *  within `nearbyDeg`), and report its date and distance in degrees (0 = this cell). */
  staleOnError?: (fetchedAt: string, distDeg: number) => void;
  nearbyDeg?: number;
};

/** Cache a computation per grid cell. Falls through if no DB. */
export async function withNasaCache<T>(
  endpoint: string,
  lat: number,
  lng: number,
  ttlHours: number,
  compute: () => Promise<T>,
  opts: CacheOpts = {}
): Promise<T> {
  const db = supabase();
  const per = Math.round(1 / (opts.cell ?? 0.1));
  const latCell = Math.round(lat * per) / per;
  const lngCell = Math.round(lng * per) / per;
  const key = `${endpoint}:${latCell}:${lngCell}`;
  if (db) {
    const { data } = await db
      .from("nasa_cache")
      .select("payload")
      .eq("key", key)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (data?.payload) return data.payload as T;
  }
  let payload: T;
  try {
    payload = await compute();
  } catch (e) {
    if (db && opts.staleOnError) {
      const { data } = await db.from("nasa_cache").select("payload, fetched_at").eq("key", key).maybeSingle();
      if (data?.payload) {
        opts.staleOnError(data.fetched_at as string, 0);
        return data.payload as T;
      }
      const r = opts.nearbyDeg;
      if (r) {
        const { data: rows } = await db
          .from("nasa_cache")
          .select("payload, fetched_at, lat_cell, lng_cell")
          .eq("endpoint", endpoint)
          .gte("lat_cell", lat - r).lte("lat_cell", lat + r)
          .gte("lng_cell", lng - r).lte("lng_cell", lng + r)
          .limit(50);
        const near = (rows ?? [])
          .map((x) => ({ ...x, d: Math.hypot(x.lat_cell - lat, x.lng_cell - lng) }))
          .sort((a, b) => a.d - b.d)[0];
        if (near?.payload) {
          opts.staleOnError(near.fetched_at as string, near.d);
          return near.payload as T;
        }
      }
    }
    throw e;
  }
  if (db) {
    await db.from("nasa_cache").upsert({
      key,
      endpoint,
      lat_cell: latCell,
      lng_cell: lngCell,
      payload,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + ttlHours * 3600_000).toISOString(),
    });
  }
  return payload;
}
