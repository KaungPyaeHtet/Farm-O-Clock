// Turns the engine's calendar weeks (day-of-year, no year) into REAL dates relative
// to today: the next time each sowing week comes round, which weeks have already
// passed this season, and the best week that is still ahead.

const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type WeekDate = { date: Date; passed: boolean };

function utcToday(now = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** Dates of the current or next sowing season for these weeks (contiguous, 7 days apart).
 *  A week has "passed" once its 7 days are over. */
export function seasonDates(weeks: { startDoy: number }[], now = new Date()): WeekDate[] {
  if (!weeks.length) return [];
  const today = utcToday(now);
  const Y = now.getUTCFullYear();
  for (const y of [Y - 1, Y, Y + 1]) {
    const first = Date.UTC(y, 0, 1) + (weeks[0].startDoy - 1) * DAY;
    const lastEnd = first + (weeks.length - 1) * 7 * DAY + 6 * DAY;
    if (lastEnd >= today) {
      return weeks.map((_, i) => {
        const d = first + i * 7 * DAY;
        return { date: new Date(d), passed: d + 6 * DAY < today };
      });
    }
  }
  return [];
}

/** Best week still ahead: highest score, earliest on ties. */
export function bestUpcoming(dates: WeekDate[], score: (i: number) => number): number {
  let best = -1;
  dates.forEach((d, i) => {
    if (!d.passed && (best < 0 || score(i) > score(best))) best = i;
  });
  return best < 0 ? 0 : best;
}

export function fmtDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "this week" / "in 3 weeks" / "in 9 months" — null if the date has passed. */
export function fromNow(d: Date, t: (en: string, my: string) => string, now = new Date()): string | null {
  const days = Math.round((d.getTime() - utcToday(now)) / DAY);
  if (days < -6) return null;
  if (days <= 6) return t("this week", "ယခုအပတ်");
  if (days < 35) {
    const w = Math.round(days / 7);
    return t(`in ${w} week${w > 1 ? "s" : ""}`, `${w} ပတ်အကြာ`);
  }
  const m = Math.round(days / 30.4);
  return t(`in ${m} month${m > 1 ? "s" : ""}`, `${m} လအကြာ`);
}

/** Same week, one year later (for "next chance" on a passed week). */
export function nextYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate()));
}
