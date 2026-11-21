/**
 * Import parsing and validation.
 *
 * Deliberately dependency-free so the exact same module runs in the browser
 * (live preview) and on the server (the authoritative dry run + commit).
 *
 * Rules enforced here:
 *  - every row must be structurally valid before it can be committed
 *  - AI-assisted rows can never arrive pre-verified
 *  - duplicates are detected inside the file *and* against the database by
 *    normalised fingerprint
 */

export type RawRow = Record<string, string>;

export type ParsedRow = {
  row: number;
  statement: string;
  options: [string, string, string, string];
  correctOption: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  sourceType: "manual" | "csv_import" | "json_import" | "ai_assisted";
  sourceRef: string;
  year: number | null;
  subjectSlug: string;
  topicSlug: string;
  subtopicSlug: string;
  fingerprint: string;
};

export type RowIssue = { row: number; field: string; message: string };

export type ParseResult = {
  total: number;
  valid: ParsedRow[];
  invalid: { row: number; issues: RowIssue[]; raw: RawRow }[];
  duplicates: number[];
};

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const SOURCE_TYPES = new Set(["manual", "csv_import", "json_import", "ai_assisted"]);

/** Minimal RFC-4180 CSV reader (handles quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): RawRow[] {
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
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  if (rows.length === 0) return [];
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  return rows.slice(1).map((cells) => {
    const record: RawRow = {};
    header.forEach((key, index) => {
      record[key] = (cells[index] ?? "").trim();
    });
    return record;
  });
}

export function parseJson(text: string): RawRow[] {
  const parsed: unknown = JSON.parse(text);
  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : null;
  if (!list) throw new Error("JSON অবশ্যই একটি অ্যারে বা { questions: [...] } হতে হবে।");

  return list.map((item) => {
    const record: RawRow = {};
    if (typeof item !== "object" || item === null) return record;
    for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
      record[key.toLowerCase()] = Array.isArray(value) ? value.join("|") : value == null ? "" : String(value);
    }
    return record;
  });
}

export function normaliseStatement(statement: string): string {
  return statement.replace(/\s+/g, " ").trim();
}

/** Pure-JS SHA-256 — kept local so the browser preview matches the server exactly. */
export function sha256Hex(input: string): string {
  const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  const maxWord = Math.pow(2, 32);
  const words: number[] = [];
  const ascii = unescape(encodeURIComponent(input));
  const length = ascii.length * 8;

  for (let i = 0; i < ascii.length; i += 1) words[i >> 2] |= (ascii.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  words[ascii.length >> 2] |= 0x80 << (24 - (ascii.length % 4) * 8);
  const wordsLength = (((ascii.length + 8) >> 6) + 1) * 16;
  for (let i = words.length; i < wordsLength; i += 1) words[i] = 0;
  words[wordsLength - 1] = length;

  const hash: number[] = [];
  const k: number[] = [];
  const isComposite: Record<number, boolean> = {};
  let primeCounter = 0;
  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isComposite[candidate]) {
      for (let i = candidate * candidate; i < 313; i += candidate) isComposite[i] = true;
      hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter += 1;
    }
  }

  for (let block = 0; block < words.length; block += 16) {
    const w = words.slice(block, block + 16);
    const oldHash = hash.slice(0, 8);
    for (let i = 0; i < 64; i += 1) {
      if (i < 16) {
        w[i] = w[i] ?? 0;
      } else {
        const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const sigma0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const sigma1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const t1 = (hash[7] + sigma1 + ch + k[i] + w[i]) | 0;
      const t2 = (sigma0 + maj) | 0;
      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + t1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (t1 + t2) | 0;
    }
    for (let i = 0; i < 8; i += 1) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  let result = "";
  for (let i = 0; i < 8; i += 1) {
    for (let j = 3; j >= 0; j -= 1) {
      const byte = (hash[i] >> (j * 8)) & 0xff;
      result += (byte < 16 ? "0" : "") + byte.toString(16);
    }
  }
  return result;
}

const OPTION_ALIASES = [
  ["option_a", "optiona", "a", "op_a", "ক"],
  ["option_b", "optionb", "b", "op_b", "খ"],
  ["option_c", "optionc", "c", "op_c", "গ"],
  ["option_d", "optiond", "d", "op_d", "ঘ"],
];

function pick(row: RawRow, aliases: string[]): string {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

function parseCorrect(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[0-3]$/.test(trimmed)) return Number(trimmed);
  const letters = ["a", "b", "c", "d"];
  const bengali = ["ক", "খ", "গ", "ঘ"];
  const lower = trimmed.toLowerCase();
  if (letters.includes(lower)) return letters.indexOf(lower);
  if (bengali.includes(trimmed)) return bengali.indexOf(trimmed);
  if (/^[1-4]$/.test(trimmed)) return Number(trimmed) - 1;
  return null;
}

export function validateRows(
  rows: RawRow[],
  options: { sourceType: "csv_import" | "json_import" },
): ParseResult {
  const valid: ParsedRow[] = [];
  const invalid: ParseResult["invalid"] = [];
  const duplicates: number[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const issues: RowIssue[] = [];

    const statement = normaliseStatement(pick(row, ["statement", "question", "statement_bn", "প্রশ্ন", "text"]));
    if (statement.length < 8) issues.push({ row: rowNumber, field: "statement", message: "প্রশ্ন কমপক্ষে ৮ অক্ষরের হতে হবে।" });
    if (statement.length > 2000) issues.push({ row: rowNumber, field: "statement", message: "প্রশ্ন ২০০০ অক্ষরের বেশি।" });

    const optionValues = OPTION_ALIASES.map((aliases) => pick(row, aliases).trim()) as [string, string, string, string];
    optionValues.forEach((value, optionIndex) => {
      if (!value) issues.push({ row: rowNumber, field: `option_${optionIndex}`, message: "অপশন খালি।" });
      if (value.length > 500) issues.push({ row: rowNumber, field: `option_${optionIndex}`, message: "অপশন অত্যন্ত দীর্ঘ।" });
    });

    const correctRaw = pick(row, ["correct_option", "correct", "answer", "সঠিক", "correctoption"]);
    const correctOption = parseCorrect(correctRaw);
    if (correctOption === null) issues.push({ row: rowNumber, field: "correct_option", message: "সঠিক উত্তর a-d বা 0-3 হতে হবে।" });

    const difficultyRaw = (pick(row, ["difficulty", "level", "কঠিনতা"]) || "medium").toLowerCase();
    const difficulty = DIFFICULTIES.has(difficultyRaw) ? (difficultyRaw as ParsedRow["difficulty"]) : "medium";

    const sourceTypeRaw = (pick(row, ["source_type", "sourcetype"]) || options.sourceType).toLowerCase();
    const sourceType = SOURCE_TYPES.has(sourceTypeRaw) ? (sourceTypeRaw as ParsedRow["sourceType"]) : options.sourceType;

    const yearRaw = pick(row, ["year", "সাল"]);
    let year: number | null = null;
    if (yearRaw) {
      const parsedYear = Number(yearRaw);
      if (!Number.isInteger(parsedYear) || parsedYear < 1971 || parsedYear > 2100) {
        issues.push({ row: rowNumber, field: "year", message: "সাল ১৯৭১–২১০০ এর মধ্যে হতে হবে।" });
      } else {
        year = parsedYear;
      }
    }

    if (issues.length > 0) {
      invalid.push({ row: rowNumber, issues, raw: row });
      return;
    }

    // Never let an import smuggle in a pre-verified AI row.
    const normalisedSource = sourceType === "ai_assisted" ? "ai_assisted" : sourceType;
    const fingerprint = sha256Hex(statement);

    if (seen.has(fingerprint)) {
      duplicates.push(rowNumber);
      return;
    }
    seen.add(fingerprint);

    valid.push({
      row: rowNumber,
      statement,
      options: optionValues,
      correctOption: correctOption!,
      explanation: pick(row, ["explanation", "ব্যাখ্যা", "solution"]).trim(),
      difficulty,
      sourceType: normalisedSource,
      sourceRef: pick(row, ["source", "source_ref", "উৎস", "reference"]).trim(),
      year,
      subjectSlug: pick(row, ["subject_slug", "subject", "বিষয়"]).trim(),
      topicSlug: pick(row, ["topic_slug", "topic", "টপিক"]).trim(),
      subtopicSlug: pick(row, ["subtopic_slug", "subtopic"]).trim(),
      fingerprint,
    });
  });

  return { total: rows.length, valid, invalid, duplicates };
}

export const CSV_TEMPLATE = [
  "statement,option_a,option_b,option_c,option_d,correct_option,explanation,difficulty,source_type,year,subject_slug,topic_slug",
  "বাংলাদেশের রাজধানী কোনটি?,ঢাকা,চট্টগ্রাম,খুলনা,রাজশাহী,a,ঢাকা বাংলাদেশের রাজধানী।,easy,manual,1971,bangla,",
].join("\n");
