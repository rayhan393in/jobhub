import { describe, expect, it } from "vitest";
import {
  BCS_COURSE_ID,
  BCS_PRIORITY_MARKS,
  bnMarks,
  parseMarksSplit,
  parsePriorityMarks,
  resolvePriorityMarks,
} from "@/lib/routine-marks";

/**
 * The exam instruction bar shows marks and nothing else, so getting these numbers
 * wrong misstates an exam. They must come from the course's own configuration,
 * and an unconfigured course must show nothing rather than borrowed BCS marks.
 */

const OTHER_COURSE = "299874c9-af13-4bb0-9269-296fe88478d8";

describe("parseMarksSplit (live exam configuration)", () => {
  it("reads settings.marks_split", () => {
    expect(parseMarksSplit({ marks_split: { P1: 40, P2: 30, "P3/P4": 20, রিভিশন: 10 } })).toEqual([
      { label: "P1", marks: 40 },
      { label: "P2", marks: 30 },
      { label: "P3/P4", marks: 20 },
      { label: "রিভিশন", marks: 10 },
    ]);
  });

  it("drops zero and non-numeric entries instead of showing them", () => {
    const parsed = parseMarksSplit({ marks_split: { P1: 50, P2: 0, P3: "n/a" } });
    expect(parsed).toEqual([{ label: "P1", marks: 50 }]);
  });

  it("returns null when there is no split", () => {
    expect(parseMarksSplit(null)).toBeNull();
    expect(parseMarksSplit({})).toBeNull();
    expect(parseMarksSplit({ marks_split: {} })).toBeNull();
    expect(parseMarksSplit({ marks_split: { P1: 0 } })).toBeNull();
  });
});

describe("parsePriorityMarks (course-level override)", () => {
  it("accepts an object", () => {
    expect(parsePriorityMarks({ priority_marks: { P1: 60, P2: 40 } })).toEqual([
      { label: "P1", marks: 60 },
      { label: "P2", marks: 40 },
    ]);
  });

  it("accepts an array of { label, marks }", () => {
    expect(
      parsePriorityMarks({
        priority_marks: [
          { label: "Electrical", marks: 60 },
          { label: "General", marks: 40 },
        ],
      }),
    ).toHaveLength(2);
  });

  it("ignores unusable shapes", () => {
    expect(parsePriorityMarks(null)).toBeNull();
    expect(parsePriorityMarks({})).toBeNull();
    expect(parsePriorityMarks({ priority_marks: [{ label: "x" }] })).toBeNull();
  });
});

describe("resolvePriorityMarks", () => {
  it("prefers the live exam configuration", () => {
    const { items, source } = resolvePriorityMarks({
      courseId: BCS_COURSE_ID,
      examSettings: { marks_split: { P1: 50, P2: 25, "P3/P4": 15, রিভিশন: 10 } },
      examConfig: { priority_marks: { P1: 99 } },
    });
    expect(source).toBe("exam");
    expect(items[0].marks).toBe(50);
  });

  it("uses the course override when there is no exam", () => {
    const { items, source } = resolvePriorityMarks({
      courseId: OTHER_COURSE,
      examConfig: { priority_marks: { Electrical: 60 } },
    });
    expect(source).toBe("config");
    expect(items).toEqual([{ label: "Electrical", marks: 60 }]);
  });

  it("uses BCS's verified split for BCS only", () => {
    const { items, source } = resolvePriorityMarks({ courseId: BCS_COURSE_ID });
    expect(source).toBe("bcs");
    expect(items).toEqual(BCS_PRIORITY_MARKS);
    expect(items.map((item) => item.marks)).toEqual([50, 25, 15, 10]);
  });

  /**
   * The whole point of course-wise config: an unconfigured course must not
   * inherit BCS's 50/25/15/10. Empty items make the bar hide.
   */
  it("returns nothing for an unconfigured non-BCS course", () => {
    const { items, source } = resolvePriorityMarks({ courseId: OTHER_COURSE });
    expect(source).toBe("none");
    expect(items).toEqual([]);
  });

  it("does not let another course inherit BCS marks", () => {
    const other = resolvePriorityMarks({ courseId: OTHER_COURSE });
    const bcs = resolvePriorityMarks({ courseId: BCS_COURSE_ID });
    expect(other.items).not.toEqual(bcs.items);
  });
});

describe("bnMarks", () => {
  it("renders integers and penalties in Bengali numerals", () => {
    expect(bnMarks(50)).toBe("৫০");
    expect(bnMarks(10)).toBe("১০");
    expect(bnMarks(0.5)).toBe("০.৫০");
    expect(bnMarks(0.25)).toBe("০.২৫");
  });
});
