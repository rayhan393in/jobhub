/**
 * Routine CSV parsing.
 *
 * Mirrors `src/lib/import/parse.ts`: dependency-free so the same module can
 * preview a file in the browser and validate it authoritatively on the server.
 *
 * The column names are chosen to match the spreadsheets a Bangla-medium
 * coaching centre actually produces, with English aliases so a hand-made file
 * works too. Anything the parser cannot map is reported, never guessed.
 */

export type RawRow = Record<string, string>;

export type ParsedRoutineRow = {
  row: number;
  day: number;
  routineDate: string | null;
  subject: string;
  topic: string;
  subtopic: string;
  minutes: number;
  slot: number;
  note: string;
  kind: "daily" | "weekly_special";
};

export type RoutineIssue = { row: number; field: string; message: string };

export type RoutineParseResult = {
  total: number;
  valid: ParsedRoutineRow[];
  invalid: { row: number; issues: RoutineIssue[] }[];
};

/** Minimal RFC-4180 reader — handles quotes, escaped quotes and CRLF. */
export function parseCsvRows(text: string): RawRow[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return [];

  const header = nonEmpty[0].map((cell) => cell.trim().toLowerCase().replace(/\s+/g, "_"));
  return nonEmpty.slice(1).map((cells) => {
    const record: RawRow = {};
    header.forEach((key, index) => {
      record[key] = (cells[index] ?? "").trim();
    });
    return record;
  });
}

const ALIASES = {
  day: ["day", "দিন", "day_no", "day_number", "দিন_নং"],
  date: ["date", "তারিখ", "routine_date", "দিনের_তারিখ"],
  subject: ["subject", "বিষয়", "subject_bn"],
  topic: ["topic", "টপিক", "topic_bn", "অধ্যায়", "chapter"],
  subtopic: ["subtopic", "সাবটপিক", "subtopic_bn", "উপ_বিষয়"],
  minutes: ["minutes", "মিনিট", "duration", "সময়", "time_minutes"],
  slot: ["slot", "স্লট", "period", "ক্লাস"],
  note: ["note", "নোট", "focus_note", "নির্দেশনা", "remarks"],
  kind: ["kind", "ধরন", "type"],
} as const;

function pick(row: RawRow, keys: readonly string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

/** Bengali digits → Latin, so "৪৫" is read as 45 rather than NaN. */
export function toLatinDigits(value: string): string {
  return value.replace(/[\u09E6-\u09EF]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6));
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Turn a routine CSV into rows the server can insert.
 *
 * `startDate` and `daysPerCycle` make a file that only has "Day 01, Day 02…"
 * still produce real calendar dates — the thing a coaching routine needs to
 * become a per-day plan.
 */
export function validateRoutineRows(
  rows: RawRow[],
  options: { startDate: string; defaultMinutes?: number },
): RoutineParseResult {
  const valid: ParsedRoutineRow[] = [];
  const invalid: RoutineParseResult["invalid"] = [];
  const base = new Date(`${options.startDate}T00:00:00Z`);
  const baseValid = !Number.isNaN(base.getTime());

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const issues: RoutineIssue[] = [];

    const dayRaw = toLatinDigits(pick(row, ALIASES.day)).replace(/[^\d]/g, "");
    const dateRaw = toLatinDigits(pick(row, ALIASES.date));

    let day = dayRaw ? Number(dayRaw) : 0;
    let routineDate: string | null = null;

    if (DATE_RE.test(dateRaw)) {
      routineDate = dateRaw;
      if (!day && baseValid) {
        // Derive the day number from the date when the file only has dates.
        const parsed = new Date(`${dateRaw}T00:00:00Z`);
        day = Math.round((parsed.getTime() - base.getTime()) / 86_400_000) + 1;
      }
    } else if (day > 0) {
      if (!baseValid) {
        issues.push({ row: rowNumber, field: "date", message: "শুরুর তারিখ বৈধ নয়।" });
      } else {
        const computed = new Date(base.getTime() + (day - 1) * 86_400_000);
        routineDate = computed.toISOString().slice(0, 10);
      }
    }

    if (!Number.isInteger(day) || day < 1 || day > 366) {
      issues.push({ row: rowNumber, field: "day", message: "দিন ১–৩৬৬ এর মধ্যে হতে হবে (অথবা সঠিক date দিন)।" });
    }

    const subject = pick(row, ALIASES.subject).trim();
    if (!subject) issues.push({ row: rowNumber, field: "subject", message: "বিষয় খালি।" });

    const topic = pick(row, ALIASES.topic).trim();
    const subtopic = pick(row, ALIASES.subtopic).trim();

    const minutesRaw = toLatinDigits(pick(row, ALIASES.minutes)).replace(/[^\d]/g, "");
    const minutes = minutesRaw ? Number(minutesRaw) : (options.defaultMinutes ?? 60);
    if (minutes < 5 || minutes > 480) {
      issues.push({ row: rowNumber, field: "minutes", message: "সময় ৫–৪৮০ মিনিটের মধ্যে হতে হবে।" });
    }

    const slotRaw = toLatinDigits(pick(row, ALIASES.slot)).replace(/[^\d]/g, "");
    const slot = slotRaw ? Number(slotRaw) : 1;

    const kindRaw = pick(row, ALIASES.kind).toLowerCase();
    const kind: "daily" | "weekly_special" =
      kindRaw.includes("weekly") || kindRaw.includes("সাপ্তাহিক") ? "weekly_special" : "daily";

    if (issues.length > 0) {
      invalid.push({ row: rowNumber, issues });
      return;
    }

    valid.push({
      row: rowNumber,
      day,
      routineDate,
      subject,
      topic,
      subtopic,
      minutes,
      slot,
      note: pick(row, ALIASES.note).trim(),
      kind,
    });
  });

  return { total: rows.length, valid, invalid };
}

export const ROUTINE_CSV_TEMPLATE = [
  "day,subject,topic,subtopic,minutes,slot,note",
  "1,English Language & Literature,Subject–verb agreement,,45,1,২০টি Vocab + ১০টি Preposition",
  "1,গাণিতিক যুক্তি,সংখ্যা পদ্ধতি,মৌলিক ও ভাজ্যতা,45,2,১৫টি অঙ্ক সমাধান",
  "2,বাংলা ভাষা ও সাহিত্য,ধ্বনি ও বর্ণমালা,স্বরধ্বনি,45,1,",
].join("\n");

/**
 * Week bookkeeping for a routine row.
 *
 * The spec plans by week, so every row needs to know which week it belongs to
 * and which day inside it. Derived from the real date — never from the file's
 * `day` column, which a coach may have renumbered mid-month.
 */
export function weekMeta(routineDate: string): { weekStart: string; weekIndex: number; dayOfWeek: number } {
  const date = new Date(`${routineDate}T00:00:00Z`);
  const dow = date.getUTCDay(); // 0 = Sunday
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const weekStart = new Date(date.getTime() + mondayOffset * 86_400_000).toISOString().slice(0, 10);
  const weekIndex = Math.floor((new Date(`${weekStart}T00:00:00Z`).getTime() - new Date("2024-01-01T00:00:00Z").getTime()) / (7 * 86_400_000)) + 1;
  return { weekStart, weekIndex: Math.max(1, Math.min(104, weekIndex)), dayOfWeek: dow === 0 ? 7 : dow };
}

/** Human slot label ("১ম স্লট", "সন্ধ্যা", …) from the file's numeric slot. */
export function slotLabel(slot: number, note: string): string {
  const match = note.match(/\d{1,2}[:.]\d{2}\s*[–\-]\s*\d{1,2}[:.]\d{2}/);
  if (match) return match[0];
  const ordinals = ["১ম", "২য়", "৩য়", "৪র্থ", "৫ম", "৬ষ্ঠ", "৭ম", "৮ম"];
  return `${ordinals[slot - 1] ?? `${slot} নং`} স্লট`;
}
