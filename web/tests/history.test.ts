// Regression for audit F04: a 90-day window that crosses New Year must compare complete,
// equivalent windows. Constant 1 mm/day everywhere → every season is 90 mm and "normal".
// Run: npm test
import assert from "node:assert/strict";
import { GET } from "../src/app/api/history/route";

// Like NASA POWER: data only for the requested start..end (no future days).
function fakePower(url: string): Response {
  const q = new URL(url).searchParams;
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  const rain: Record<string, number> = {};
  const temp: Record<string, number> = {};
  for (let t = d(q.get("start")!); t <= d(q.get("end")!); t += 86_400_000) {
    const k = new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
    rain[k] = 1;
    temp[k] = 25;
  }
  return new Response(JSON.stringify({ properties: { parameter: { PRECTOTCORR: rain, T2M: temp } } }));
}

const RealDate = Date;
async function at(iso: string) {
  const fixed = new RealDate(iso).getTime();
  // @ts-expect-error minimal fixed clock
  globalThis.Date = class extends RealDate {
    constructor(...a: unknown[]) {
      // @ts-expect-error spread into Date
      super(...(a.length ? a : [fixed]));
    }
    static now() {
      return fixed;
    }
  };
  globalThis.fetch = (async (u: string) => fakePower(String(u))) as typeof fetch;
  try {
    const res = await GET(new Request("http://x/api/history?lat=16.7&lng=95.6") as never);
    return { status: res.status, body: await res.json() };
  } finally {
    globalThis.Date = RealDate;
  }
}

async function main() {
for (const day of ["2026-01-20", "2026-02-20", "2028-03-05", "2026-11-15"]) {
  const r = await at(`${day}T12:00:00Z`);
  assert.equal(r.status, 200, `${day}: ${JSON.stringify(r.body)}`);
  assert.equal(r.body.verdict, "normal", day);
  assert.equal(r.body.rainfall.thisYear, 90, day);
  assert.equal(r.body.rainfall.normal, 90, day);
  assert.ok(r.body.years >= 19, `${day}: ${r.body.years} seasons`);
  console.log("ok", day, r.body.seasonLabel, r.body.years, "seasons");
}
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
