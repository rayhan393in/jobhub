import { describe, expect, it } from "vitest";
import {
  GRID_SLOTS,
  gridSlotFor,
  parseMcqSplit,
  MCQ_DEFAULT_SPLIT,
  phaseForDay,
  PHASES,
} from "@/lib/routine-day-lines";

/**
 * The 90-day sheet puts each published row into one of three columns. If the
 * slot labels ever change, rows would silently vanish from the grid (the
 * component renders nothing for an unknown slot), so the mapping is pinned.
 */
describe("gridSlotFor", () => {
  it("maps the three study slots to their pillars", () => {
    expect(gridSlotFor("P1 Main · সকাল ৭:০০–৯:৩০")).toBe("p1");
    expect(gridSlotFor("P2 Second · সকাল ১০:০০–১১:১৫")).toBe("p2");
    expect(gridSlotFor("P3/P4 Third · বিকাল ৫:০০–৫:৪৫")).toBe("p3");
  });

  it("keeps the MCQ block out of the three study columns", () => {
    expect(gridSlotFor("MCQ ও ভুল বিশ্লেষণ · রাত ৮:০০–৮:৫০")).toBeNull();
    expect(gridSlotFor(null)).toBeNull();
    expect(gridSlotFor("")).toBeNull();
  });

  it("does not confuse P3/P4 with P2", () => {
    expect(GRID_SLOTS.map((slot) => slot.slot)).toEqual(["p1", "p2", "p3"]);
    expect(gridSlotFor("P3/P4 Third · যেকোনো সময়")).toBe("p3");
  });
});

describe("phaseForDay", () => {
  it("covers all 90 days exactly once", () => {
    for (let day = 1; day <= 90; day += 1) {
      expect(phaseForDay(day), `day ${day}`).not.toBeNull();
    }
    expect(PHASES.map((p) => [p.from, p.to])).toEqual([
      [1, 30],
      [31, 60],
      [61, 90],
    ]);
  });

  it("puts the boundaries on the right side", () => {
    expect(phaseForDay(30)?.from).toBe(1);
    expect(phaseForDay(31)?.from).toBe(31);
    expect(phaseForDay(60)?.from).toBe(31);
    expect(phaseForDay(61)?.from).toBe(61);
  });

  it("returns null outside the plan instead of inventing a phase", () => {
    expect(phaseForDay(0)).toBeNull();
    expect(phaseForDay(91)).toBeNull();
  });
});

describe("parseMcqSplit", () => {
  it("reads the split out of the plan's own MCQ note", () => {
    const note = "P1 50 + P2 25 + P3/P4 15 + পূর্বে-পড়া 10 = ১০০ প্রশ্ন · ৫০ মিনিট";
    expect(parseMcqSplit(note)).toEqual({ p1: 50, p2: 25, p3: 15, revisit: 10 });
  });

  it("falls back to the documented split when the note is missing or partial", () => {
    expect(parseMcqSplit(null)).toEqual(MCQ_DEFAULT_SPLIT);
    expect(parseMcqSplit("")).toEqual(MCQ_DEFAULT_SPLIT);
    expect(parseMcqSplit("P1 50 + P2 25")).toEqual(MCQ_DEFAULT_SPLIT);
  });

  it("always totals 100 for the default split", () => {
    const split = MCQ_DEFAULT_SPLIT;
    expect(split.p1 + split.p2 + split.p3 + split.revisit).toBe(100);
  });
});
