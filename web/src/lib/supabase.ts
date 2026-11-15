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

/** Cache a NASA computation per ~0.1° cell. Falls through if no DB. */
export async function withNasaCache<T>(
  endpoint: string,
  lat: number,
  lng: number,
  ttlHours: number,
  compute: () => Promise<T>
): Promise<T> {
  const db = supabase();
  const latCell = Math.round(lat * 10) / 10;
  const lngCell = Math.round(lng * 10) / 10;
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
  const payload = await compute();
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
