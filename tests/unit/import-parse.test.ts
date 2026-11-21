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

/**
 * The Drive CSV that started this work carries provenance columns the original
 * importer dropped on the floor. These tests pin the behaviour that matters:
 * a real past-exam question keeps its exam name, and nothing is invented when
 * the file is silent.
 */
describe("past-exam provenance", () => {
  const base = {
    statement: "Subject–verb agreement প্রশ্ন?",
    option_a: "ক", option_b: "খ", option_c: "গ", option_d: "ঘ",
    correct: "D",
  };

  it("keeps source_type='previous' instead of flattening it to csv_import", () => {
    const result = validateRows(
      [{ ...base, source_type: "previous", exam_name: "৪০তম বিসিএস", difficulty: "standard" }],
      { sourceType: "csv_import" },
    );
    expect(result.valid[0].sourceType).toBe("previous");
    expect(result.valid[0].examName).toBe("৪০তম বিসিএস");
  });

  it("maps 'standard' to medium instead of silently dropping the label", () => {
    const result = validateRows([{ ...base, difficulty: "standard" }], { sourceType: "csv_import" });
    expect(result.valid[0].difficulty).toBe("medium");
  });

  it("accepts Bengali difficulty words", () => {
    const hard = validateRows([{ ...base, difficulty: "কঠিন" }], { sourceType: "csv_import" });
    const easy = validateRows([{ ...base, difficulty: "সহজ" }], { sourceType: "csv_import" });
    expect(hard.valid[0].difficulty).toBe("hard");
    expect(easy.valid[0].difficulty).toBe("easy");
  });

  it("rejects an unrecognised difficulty rather than guessing one", () => {
    const result = validateRows([{ ...base, difficulty: "impossible" }], { sourceType: "csv_import" });
    expect(result.valid).toHaveLength(0);
    expect(result.invalid[0].issues[0].field).toBe("difficulty");
  });

  it("refuses a 'previous' question with no attributable source", () => {
    const result = validateRows([{ ...base, source_type: "previous" }], { sourceType: "csv_import" });
    expect(result.valid).toHaveLength(0);
    expect(result.invalid[0].issues[0].field).toBe("exam_name");
  });

  it("carries book, chapter and page through", () => {
    const result = validateRows(
      [{
        ...base,
        source_title: "খাইরুলের ইংরেজি", book_chapter: "Chapter 3",
        book_page: "১২৫", author: "খাইরুল ইসলাম", edition: "৫ম",
      }],
      { sourceType: "csv_import" },
    );
    const row = result.valid[0];
    expect(row.sourceTitle).toBe("খাইরুলের ইংরেজি");
    expect(row.bookChapter).toBe("Chapter 3");
    expect(row.bookPage).toBe(125);
    expect(row.author).toBe("খাইরুল ইসলাম");
    expect(row.edition).toBe("৫ম");
  });

  it("parses a page range down to its first page", () => {
    const result = validateRows([{ ...base, book_page: "125-126" }], { sourceType: "csv_import" });
    expect(result.valid[0].bookPage).toBe(125);
  });

  it("leaves provenance null when the file says nothing — never invented", () => {
    const result = validateRows([base], { sourceType: "csv_import" });
    const row = result.valid[0];
    expect(row.examName).toBe("");
    expect(row.bookPage).toBeNull();
    expect(row.sourceTitle).toBe("");
  });

  it("reads the Drive CSV's exact 19-column header", () => {
    const csv = [
      "track,subject,question,A,B,C,D,correct,explanation,source_type,source_title,source_locator,source_url,exam_name,exam_year,author,edition,topic,difficulty",
      'BCS,English Language & Literature,"Choose the correct sentence",1,2,3,4,D,ব্যাখ্যা,previous,Satt Academy,x,y,16th BCS Preli,1994,,,Subject-verb agreement,standard',
    ].join("\n");
    const result = validateRows(parseCsv(csv), { sourceType: "csv_import" });
    expect(result.invalid).toHaveLength(0);
    const row = result.valid[0];
    expect(row.sourceType).toBe("previous");
    expect(row.examName).toBe("16th BCS Preli");
    expect(row.year).toBe(1994);
    expect(row.difficulty).toBe("medium");
    expect(row.correctOption).toBe(3);
    expect(row.explanation).toBe("ব্যাখ্যা");
  });
});

describe("page numbers embedded in a locator", () => {
  const base = {
    statement: "The director and the owner ___ signed the contract.",
    option_a: "has", option_b: "is", option_c: "have", option_d: "was", correct: "C",
  };

  it("reads 'PDF পৃ. 448' as page 448", () => {
    const result = validateRows(
      [{ ...base, source_title: "MASTER — A most helpful book of English", source_locator: "PDF পৃ. 448; ধারণাভিত্তিক নতুন রচনা" }],
      { sourceType: "csv_import" },
    );
    expect(result.valid[0].bookPage).toBe(448);
  });

  it("prefers an explicit page column over the locator", () => {
    const result = validateRows(
      [{ ...base, source_locator: "PDF পৃ. 448", book_page: "12" }],
      { sourceType: "csv_import" },
    );
    expect(result.valid[0].bookPage).toBe(12);
  });

  it("leaves the page null when the locator states none", () => {
    const result = validateRows(
      [{ ...base, source_type: "previous", exam_name: "16th BCS Preli", source_locator: "প্রশ্নের নিজস্ব page; URL-এ locator" }],
      { sourceType: "csv_import" },
    );
    expect(result.valid[0].bookPage).toBeNull();
  });

  it("reads an English locator too", () => {
    const result = validateRows([{ ...base, source_locator: "Book, p. 77" }], { sourceType: "csv_import" });
    expect(result.valid[0].bookPage).toBe(77);
  });
});
