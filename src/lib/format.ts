const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBengaliDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)]);
}

export type Locale = "bn" | "en";

/** Localised number: Bengali digits for `bn`, grouped Latin for `en`. */
export function formatNumber(value: number | null | undefined, locale: Locale = "bn"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const rounded = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  return locale === "bn" ? toBengaliDigits(rounded) : rounded;
}

export function formatDecimal(value: number | null | undefined, locale: Locale = "bn", digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const text = value.toFixed(digits);
  return locale === "bn" ? toBengaliDigits(text) : text;
}

export function formatPercent(value: number | null | undefined, locale: Locale = "bn"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${formatDecimal(value, locale, 1)}%`;
}

export const DHAKA_TZ = "Asia/Dhaka";

export function formatDate(
  value: string | Date | null | undefined,
  locale: Locale = "bn",
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" },
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    ...options,
    timeZone: DHAKA_TZ,
  }).format(date);
}

export function formatTime(value: string | Date | null | undefined, locale: Locale = "bn"): string {
  return formatDate(value, locale, { hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatDateTime(value: string | Date | null | undefined, locale: Locale = "bn"): string {
  return formatDate(value, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatWeekday(value: string | Date, locale: Locale = "bn"): string {
  return formatDate(value, locale, { weekday: "long" });
}

/** Exam clock in mm:ss / h:mm:ss. */
export function formatClock(totalSeconds: number, locale: Locale = "bn"): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const text = hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  return locale === "bn" ? toBengaliDigits(text) : text;
}

/** Dhaka-local ISO date (YYYY-MM-DD) — matches how routines are stored. */
export function dhakaDateKey(value: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DHAKA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function dhakaClock(value: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DHAKA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

export function greeting(locale: Locale = "bn"): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: DHAKA_TZ, hour: "2-digit", hour12: false }).format(new Date()),
  );
  if (locale === "bn") {
    if (hour < 6) return "শুভ রাত্রি";
    if (hour < 12) return "শুভ সকাল";
    if (hour < 16) return "শুভ দুপুর";
    if (hour < 19) return "শুভ বিকেল";
    return "শুভ সন্ধ্যা";
  }
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function relativeFromNow(value: string | Date, locale: Locale = "bn"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const diffMs = date.getTime() - Date.now();
  const absMinutes = Math.abs(Math.round(diffMs / 60000));
  const rtf = new Intl.RelativeTimeFormat(locale === "bn" ? "bn" : "en", { numeric: "auto" });
  if (absMinutes < 60) return rtf.format(Math.round(diffMs / 60000), "minute");
  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) return rtf.format(Math.round(diffMs / 3600000), "hour");
  return rtf.format(Math.round(diffMs / 86400000), "day");
}
