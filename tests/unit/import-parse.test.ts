import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { parseCsv, parseJson, sha256Hex, validateRows } from "@/lib/import/parse";

describe("csv parsing", () => {
  it("reads quoted fields, escaped quotes and CRLF line endings", () => {
    const csv = [
      "statement,option_a,option_b,option_c,option_d,correct_option",
      '"কোনটি ""বাংলা"" ভাষার?","ক","খ","গ","ঘ",a',
      "দ্বিতীয় প্রশ্ন?,১,২,৩,৪,2",
    ].join("\r\n");

    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].statement).toBe('কোনটি "বাংলা" ভাষার?');
    expect(rows[1].correct_option).toBe("2");
  });

  it("strips a UTF-8 BOM and ignores blank lines", () => {
    const rows = parseCsv("\uFEFFstatement,option_a,option_b,option_c,option_d,correct_option\n\nপ্রশ্ন এক?,a,b,c,d,0\n");
    expect(rows).toHaveLength(1);
    expect(rows[0].statement).toBe("প্রশ্ন এক?");
  });

  it("returns nothing for an empty document", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("json parsing", () => {
  it("accepts an array of questions", () => {
    const rows = parseJson(JSON.stringify([{ statement: "প্রশ্ন?", option_a: "ক" }]));
    expect(rows[0].statement).toBe("প্রশ্ন?");
    expect(rows[0].option_a).toBe("ক");
  });

  it("accepts a { questions: [...] } envelope", () => {
    const rows = parseJson(JSON.stringify({ questions: [{ Statement: "প্রশ্ন?" }] }));
    expect(rows[0].statement).toBe("প্রশ্ন?");
  });

  it("rejects other shapes", () => {
    expect(() => parseJson(JSON.stringify({ nope: true }))).toThrow();
  });
});

describe("fingerprinting", () => {
  it("matches node's sha256 for Bangla text", () => {
    const statement = "বাংলা বর্ণমালায় মোট স্বরবর্ণ কতটি?";
    const expected = createHash("sha256").update(statement, "utf8").digest("hex");
    expect(sha256Hex(statement)).toBe(expected);
  });

  it("is stable across runs for long text", () => {
    const text = "প্রশ্ন ".repeat(200);
    expect(sha256Hex(text)).toBe(sha256Hex(text));
  });
});

describe("row validation", () => {
  const base = {
    statement: "বাংলাদেশের রাজধানী কোনটি?",
    option_a: "ঢাকা",
    option_b: "চট্টগ্রাম",
    option_c: "খুলনা",
    option_d: "রাজশাহী",
    correct_option: "a",
  };

  it("accepts a well-formed row", () => {
    const result = validateRows([base], { sourceType: "csv_import" });
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(0);
    expect(result.valid[0].correctOption).toBe(0);
    expect(result.valid[0].sourceType).toBe("csv_import");
  });

  it("accepts answer letters, digits and Bengali option letters", () => {
    for (const value of ["b", "1"]) {
      const result = validateRows([{ ...base, correct_option: value }], { sourceType: "csv_import" });
      expect(result.valid[0]?.correctOption).toBe(1);
    }
    const result = validateRows([{ ...base, correct_option: "গ" }], { sourceType: "csv_import" });
    expect(result.valid[0]?.correctOption).toBe(2);
  });

  it("reports short statements and missing options instead of guessing", () => {
    const result = validateRows([{ ...base, statement: "কি?", option_c: "" }], { sourceType: "csv_import" });
    expect(result.valid).toHaveLength(0);
    expect(result.invalid[0].issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["statement", "option_2"]),
    );
  });

  it("rejects an out-of-range year", () => {
    const result = validateRows([{ ...base, year: "1200" }], { sourceType: "csv_import" });
    expect(result.invalid[0].issues[0].field).toBe("year");
  });

  it("flags duplicates inside the same file", () => {
    const result = validateRows([base, { ...base }], { sourceType: "csv_import" });
    expect(result.valid).toHaveLength(1);
    expect(result.duplicates).toEqual([2]);
  });

  it("never marks an imported AI row as verified", () => {
    const result = validateRows(
      [{ ...base, source_type: "ai_assisted", is_verified: "true", status: "approved" }],
      { sourceType: "csv_import" },
    );
    expect(result.valid[0].sourceType).toBe("ai_assisted");
    // validateRows output has no verification field at all: imports cannot self-approve.
    expect(result.valid[0]).not.toHaveProperty("isVerified");
  });
});
