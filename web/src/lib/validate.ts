// Shared request checks for POST bodies (audit F10): coordinates must be real JSON numbers.
// Number(null) === 0 and Number("") === 0, so a plain Number() check would accept them as 0,0.

export function coords(b: unknown): { lat: number; lng: number } | null {
  const o = b as { lat?: unknown; lng?: unknown } | null;
  const { lat, lng } = o ?? {};
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
