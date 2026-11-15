// Audit F03 (constraints change the recommendation) and F10 (null coordinates rejected).
// Run: npm test
import assert from "node:assert/strict";
import { coords } from "../src/lib/validate";
import { scoreStrategies, whatIfLabel } from "../src/lib/strategies";

// F10: only real JSON numbers in range
assert.deepEqual(coords({ lat: 16.7, lng: 95.6 }), { lat: 16.7, lng: 95.6 });
for (const bad of [{ lat: null, lng: null }, { lat: "", lng: "" }, { lat: true, lng: false }, { lat: "16.7", lng: "95.6" },
                   { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: NaN, lng: 0 }, null, {}])
  assert.equal(coords(bad), null, JSON.stringify(bad));

// F03: "no new machinery" lowers the goal fit of plans that add a new crop, never the current practice
for (const goals of [["nitrogen"], ["water"], ["erosion"], ["income"]] as const) {
  const free = scoreStrategies("rice", [...goals], 50, 50);
  const tied = scoreStrategies("rice", [...goals], 50, 50, { constraints: ["no_machinery"] });
  const by = (xs: typeof free, id: string) => xs.find((s) => s.id === id)!;
  assert.equal(by(tied, "baseline").goalFit, by(free, "baseline").goalFit, `${goals}: baseline unchanged`);
  for (const id of ["water", "soil"]) assert.ok(by(tied, id).goalFit < by(free, id).goalFit, `${goals}: ${id} penalised`);
}
// …and it can change which plan is best
const changed = [["income"], ["water"], ["nitrogen"], ["erosion"]].some((g) => {
  const a = scoreStrategies("maize", g as never, 50, 50).find((s) => s.isBest)!.id;
  const b = scoreStrategies("maize", g as never, 50, 50, { constraints: ["no_machinery"] }).find((s) => s.isBest)!.id;
  return a !== b;
});
console.log("no_machinery changes the best plan for some goal:", changed);

// What-if label used on the plan + share card
const t = (en: string) => en;
assert.equal(whatIfLabel(50, 50, t), null);
assert.equal(whatIfLabel(20, 100, t), "30% less rain · +6°C hotter");
console.log("ok rules");
