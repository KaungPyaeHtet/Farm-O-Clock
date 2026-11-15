"use client";

import { useEffect, useMemo, useState } from "react";
import type { CropGoals, HistoryData, LatLng, Verdict } from "@/lib/types";
import { scoreStrategies } from "@/lib/strategies";
import { buildBrief, type Lang } from "@/lib/brief";

export default function Screen6Guidance({
  pin,
  cropGoals,
}: {
  pin: LatLng | null;
  cropGoals: CropGoals;
}) {
  const [lang, setLang] = useState<Lang>("en");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);

  // Best strategy under the neutral (as-expected) scenario.
  const best = useMemo(() => {
    const scored = scoreStrategies(cropGoals.crop, cropGoals.goals, 50, 50);
    return scored.find((s) => s.isBest) ?? scored[0];
  }, [cropGoals.crop, cropGoals.goals]);

  // Pull the historical verdict to enrich the brief (optional).
  useEffect(() => {
    if (!pin) return;
    let active = true;
    fetch(`/api/history?lat=${pin.lat}&lng=${pin.lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: HistoryData | null) => active && d && setVerdict(d.verdict))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pin]);

  const brief = useMemo(
    () => buildBrief(cropGoals.crop, cropGoals.goals, best, verdict, lang),
    [cropGoals.crop, cropGoals.goals, best, verdict, lang]
  );

  // Stop any speech when language changes or on unmount.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  function toggleSpeak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(brief.readAloud);
    u.lang = lang === "my" ? "my-MM" : "en-US";
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  function copySummary() {
    const text = [
      brief.headline,
      ...brief.body,
      "",
      lang === "en" ? "Field checklist:" : "ကွင်းဆင်း စစ်ဆေးရန်-",
      ...brief.checklist.map((c) => `- ${c}`),
    ].join("\n");
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-bold text-neutral-900">{brief.headline}</h2>
        {/* Language toggle */}
        <div className="flex overflow-hidden rounded-full border border-neutral-300 text-xs font-medium">
          {(["en", "my"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 transition ${
                lang === l
                  ? "bg-green-600 text-white"
                  : "bg-white text-neutral-600"
              }`}
            >
              {l === "en" ? "EN" : "မြန်မာ"}
            </button>
          ))}
        </div>
      </div>

      {/* Read aloud */}
      <button
        onClick={toggleSpeak}
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-green-600 px-3 py-1.5 text-sm font-medium text-green-700 transition hover:bg-green-50"
      >
        {speaking ? "⏹ Stop" : "🔊 Read aloud"}
      </button>

      {/* Brief */}
      <div className="mt-3 space-y-2 rounded-2xl border border-neutral-200 bg-white p-4">
        {brief.body.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-neutral-700">
            {p}
          </p>
        ))}
      </div>

      {/* Term definitions */}
      {brief.terms.length > 0 && (
        <div className="mt-3">
          <h3 className="text-sm font-semibold text-neutral-700">
            {lang === "en" ? "Terms explained" : "ဝေါဟာရ ရှင်းလင်းချက်"}
          </h3>
          <div className="mt-2 space-y-2">
            {brief.terms.map((t) => (
              <div
                key={t.term}
                className="rounded-xl bg-neutral-50 p-3 text-sm"
              >
                <span className="font-semibold text-neutral-900">
                  {t.term}:
                </span>{" "}
                <span className="text-neutral-600">{t.def}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Field-check checklist */}
      <h3 className="mt-5 text-sm font-semibold text-neutral-700">
        {lang === "en"
          ? "✅ Check these before you plant"
          : "✅ မစိုက်ခင် ဤအချက်များ စစ်ဆေးပါ"}
      </h3>
      <div className="mt-2 space-y-2">
        {brief.checklist.map((item, i) => {
          const on = !!checked[i];
          return (
            <button
              key={i}
              onClick={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition ${
                on
                  ? "border-green-600 bg-green-50 text-neutral-500 line-through"
                  : "border-neutral-300 bg-white text-neutral-700"
              }`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-xs ${
                  on
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-neutral-300 text-transparent"
                }`}
              >
                ✓
              </span>
              <span>{item}</span>
            </button>
          );
        })}
      </div>

      {/* Finish action */}
      <button
        onClick={copySummary}
        className="mt-5 w-full rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
      >
        {copied
          ? lang === "en"
            ? "✓ Copied!"
            : "✓ ကူးယူပြီး!"
          : lang === "en"
            ? "📋 Copy summary to share"
            : "📋 အကျဉ်းချုပ် ကူးယူမည်"}
      </button>
      <div className="h-2" />
    </div>
  );
}
