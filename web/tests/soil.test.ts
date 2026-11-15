// Live check of the soil route against ISRIC (network): Myanmar, Kenya, Brazil, Romania.
// Run: NODE_OPTIONS=--conditions=react-server npx tsx tests/soil.test.ts
import assert from "node:assert/strict";
import { GET } from "../src/app/api/soil/route";

async function main() {
  for (const [lat, lng] of [[16.9568, 95.5357], [0.4957, 34.8015], [-12.5445, -55.7234], [45.9511, 21.9727]]) {
    const t = Date.now();
    const res = await GET(new Request(`http://x/api/soil?lat=${lat}&lng=${lng}`) as never);
    const body = await res.json();
    console.log(lat, lng, res.status, `${((Date.now() - t) / 1000).toFixed(1)}s`, body.texture ?? body.error, body.ph);
    assert.equal(res.status, 200);
    assert.ok(body.clay + body.sand + body.silt > 90 && body.clay + body.sand + body.silt < 110);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
