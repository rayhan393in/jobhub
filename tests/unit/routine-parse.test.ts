import { describe, expect, it } from "vitest";
import { parseCsvRows, slotLabel, validateRoutineRows, weekMeta } from "@/lib/routines/parse";

describe("routine week meta", () => {
  it("anchors a Saturday to the Monday that started its week", () => {
    expect(weekMeta("2026-11-21").weekStart).toBe("2026-11-16");
    expect(weekMeta("2026-11-21").dayOfWeek).toBe(6);
  });

  it("treats Sunday as the last day of the ISO week", () => {
    const meta = weekMeta("2026-11-22");
    expect(meta.weekStart).toBe("2026-11-16");
    expect(meta.dayOfWeek).toBe(7);
  });

  it("keeps the week index inside the column's 1–104 range", () => {
    for (const date of ["2024-01-01", "2026-11-16", "2030-06-10", "1999-03-04"]) {
      const { weekIndex } = weekMeta(date);
      expect(weekIndex).toBeGreaterThanOrEqual(1);
      expect(weekIndex).toBeLessThanOrEqual(104);
    }
  });
});

describe("slot labels", () => {
  it("prefers a real clock range found in the note", () => {
    expect(slotLabel(1, "07:30–09:00 English Vocab")).toBe("07:30–09:00");
    expect(slotLabel(2, "রাত ৯টা: 21.15-23.15 EEE")).toBe("21.15-23.15");
  });

  it("falls back to a Bangla ordinal when the note has no clock", () => {
    expect(slotLabel(1, "সংখ্যা পদ্ধতি")).toBe("১ম স্লট");
    expect(slotLabel(3, "")).toBe("৩য় স্লট");
  });

  it("never produces an empty label for a large slot number", () => {
    expect(slotLabel(12, "")).toBe("12 নং স্লট");
  });
});

describe("routine CSV validation", () => {
  const opts = { startDate: "2026-11-16", defaultMinutes: 45 };

  it("reads the Petrobangla-style day/slot file", () => {
    const csv = [
      "day,slot,subject,topic,minutes,note",
      '1,1,English Language & Literature,"Subject–verb agreement",90,07:30–09:00 Vocab+Grammar',
      "1,2,গাণিতিক যুক্তি,শতকরা,150,12:30–15:00",
    ].join("\n");
    const result = validateRoutineRows(parseCsvRows(csv), opts);
    expect(result.invalid).toHaveLength(0);
    expect(result.valid[0].routineDate).toBe("2026-11-16");
    expect(result.valid[0].minutes).toBe(90);
    expect(result.valid[1].slot).toBe(2);
  });

  it("accepts Bengali digits in day and minutes", () => {
    const result = validateRoutineRows(
      [ { day: "২", subject: "বাংলা", topic: "ধ্বনি", minutes: "৬০" } ],
      opts,
    );
    expect(result.valid[0].day).toBe(2);
    expect(result.valid[0].minutes).toBe(60);
  });

  it("rejects a row with no subject instead of scheduling a blank slot", () => {
    const result = validateRoutineRows([{ day: "1", topic: "কিছু" }], opts);
    expect(result.invalid[0].issues[0].field).toBe("subject");
  });

  it("rejects minutes outside 5–480", () => {
    const result = validateRoutineRows([{ day: "1", subject: "বাংলা", minutes: "900" }], opts);
    expect(result.invalid[0].issues[0].field).toBe("minutes");
  });

  it("applies the default duration when the file omits it", () => {
    const result = validateRoutineRows([{ day: "1", subject: "বাংলা" }], { ...opts, defaultMinutes: 75 });
    expect(result.valid[0].minutes).toBe(75);
  });

  it("marks a weekly row as weekly_special", () => {
    const result = validateRoutineRows([{ day: "7", subject: "বাংলা", kind: "weekly" }], opts);
    expect(result.valid[0].kind).toBe("weekly_special");
  });
});
