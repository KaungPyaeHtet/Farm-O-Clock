"use client";

import { FlaskConical } from "lucide-react";
import { useScience } from "@/lib/science";
import { useLang } from "@/lib/i18n";

// A detail panel that only appears when "Show the science" is on.
export default function Science({ children }: { children: React.ReactNode }) {
  const { show } = useScience();
  const { t } = useLang();
  if (!show) return null;
  return (
    <div className="mt-3 rounded-xl border border-grass/20 bg-grass/[0.05] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-grass">
        <FlaskConical className="h-3.5 w-3.5" /> {t("The science", "သိပ္ပံနည်းကျ")}
      </div>
      <div className="space-y-1 text-xs leading-relaxed text-muted">{children}</div>
    </div>
  );
}
