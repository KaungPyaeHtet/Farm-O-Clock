"use client";

import { useEffect, useMemo, useState } from "react";
import { Volume2, Square, Share2, Check, Hand } from "lucide-react";
import type { CropGoals, HistoryData, LatLng, Verdict } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { scoreStrategies } from "@/lib/strategies";
import { buildBrief } from "@/lib/brief";
import { card } from "@/lib/ui";
import Science from "@/components/Science";

export default function Screen6Guidance({
  pin,
  cropGoals,
}: {
  pin: LatLng | null;
  cropGoals: CropGoals;
}) {
  const { lang, t } = useLang();
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fieldDamp, setFieldDamp] = useState<boolean | null>(null);

  const best = useMemo(() => {
    const scored = scoreStrategies(cropGoals.crop, cropGoals.goals, 50, 50);
    return scored.find((s) => s.isBest) ?? scored[0];
  }, [cropGoals.crop, cropGoals.goals]);

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
      t("Field checklist:", "ကွင်းဆင်း စစ်ဆေးရန်-"),
      ...brief.checklist.map((c) => `- ${c}`),
    ].join("\n");
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-ink">{brief.headline}</h2>
        <button
          onClick={toggleSpeak}
          className="inline-flex items-center gap-1.5 rounded-full border border-grass/50 px-3 py-1.5 text-sm font-semibold text-grass transition hover:bg-grass/10"
        >
          {speaking ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          {speaking ? t("Stop", "ရပ်") : t("Read aloud", "ဖတ်ပြ")}
        </button>
      </div>

      {/* Brief */}
      <div className={`mt-3 space-y-2 ${card} p-4`}>
        {brief.body.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-ink">
            {p}
          </p>
        ))}
      </div>

      {/* Field check that talks back — the farmer's own knowledge can shift the advice */}
      <div className={`mt-3 ${card} p-3`}>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Hand className="h-4 w-4 text-grass" />
          {t("Does your soil already feel damp?", "သင့်မြေက ယခုပင် စိုနေပြီလား?")}
        </p>
        <div className="mt-2 flex gap-2">
          {[
            { v: true, en: "Yes, it's damp", my: "ဟုတ်၊ စိုနေသည်" },
            { v: false, en: "No, it's dry", my: "မဟုတ်၊ ခြောက်နေသည်" },
          ].map((o) => (
            <button
              key={String(o.v)}
              onClick={() => setFieldDamp(o.v)}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${
                fieldDamp === o.v
                  ? "border-grass bg-grass text-white"
                  : "border-hair bg-surface text-ink"
              }`}
            >
              {t(o.en, o.my)}
            </button>
          ))}
        </div>
        {fieldDamp === true && verdict === "dry" && (
          <p className="mt-2 rounded-xl bg-grass/10 p-2.5 text-xs leading-relaxed text-grass-strong">
            {t(
              "The satellites read this season as dry, but you can see your field. Trust the ground — we've eased the drought caution for you.",
              "ဂြိုဟ်တုက ဤရာသီကို ခြောက်သွေ့သည်ဟု ဖတ်သော်လည်း သင့်လယ်ကို သင်မြင်နေသည်။ မြေကို ယုံပါ — မိုးခေါင်သတိပေးချက်ကို လျှော့ပေးထားပါသည်။"
            )}
          </p>
        )}
        {fieldDamp === false && verdict === "wet" && (
          <p className="mt-2 rounded-xl bg-sun/10 p-2.5 text-xs leading-relaxed text-[#9a6a0c]">
            {t(
              "The satellites read this season as wet, but your ground is dry. Check for drainage or dry pockets before you sow.",
              "ဂြိုဟ်တုက ဤရာသီကို စိုသည်ဟု ဖတ်သော်လည်း သင့်မြေ ခြောက်နေသည်။ မစိုက်ခင် ရေထုတ်မြောင်း သို့ ခြောက်သည့်နေရာ စစ်ပါ။"
            )}
          </p>
        )}
      </div>

      {/* Terms */}
      {brief.terms.length > 0 && (
        <div className="mt-3">
          <h3 className="text-sm font-bold text-ink">
            {t("Terms explained", "ဝေါဟာရ ရှင်းလင်းချက်")}
          </h3>
          <div className="mt-2 space-y-2">
            {brief.terms.map((term) => (
              <div key={term.term} className="rounded-2xl border border-hair bg-surface p-3 text-sm">
                <span className="font-bold text-ink">{term.term}:</span>{" "}
                <span className="text-muted">{term.def}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checklist */}
      <h3 className="mt-5 flex items-center gap-1.5 text-sm font-bold text-ink">
        <Check className="h-4 w-4 text-grass" />
        {t("Check these before you plant", "မစိုက်ခင် ဤအချက်များ စစ်ဆေးပါ")}
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
                  ? "border-grass/50 bg-grass/10 text-muted line-through"
                  : "border-hair bg-surface text-ink"
              }`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                  on ? "border-grass bg-grass text-white" : "border-hair text-transparent"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
              </span>
              <span>{item}</span>
            </button>
          );
        })}
      </div>

      {/* Share */}
      <button
        onClick={copySummary}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-hair bg-surface py-3.5 text-sm font-bold text-ink transition hover:bg-black/[0.03]"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-grass" /> {t("Copied!", "ကူးယူပြီး!")}
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" /> {t("Copy summary to share", "အကျဉ်းချုပ် ကူးယူမည်")}
          </>
        )}
      </button>

      <Science>
        <p>
          {t(
            "Recommendation = our transparent scoring model (soil / water / resilience, weighted by your goals). A placeholder for the XGBoost model.",
            "အကြံပြုချက် = ပွင့်လင်းသော အမှတ်ပေးစနစ် (မြေ / ရေ / ခံနိုင်ရည်၊ သင့်ရည်မှန်းချက်ဖြင့် အလေးချိန်)။ XGBoost အစားထိုး။"
          )}
        </p>
        <p>
          {t(
            "Season verdict = rainfall vs the 20-year NASA POWER baseline for this exact point.",
            "ရာသီဆုံးဖြတ်ချက် = ဤနေရာအတွက် ၂၀ နှစ် NASA POWER အခြေခံနှင့် မိုးရေ နှိုင်းယှဉ်ချက်။"
          )}
        </p>
      </Science>
      <div className="h-2" />
    </div>
  );
}
