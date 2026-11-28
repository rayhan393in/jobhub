import { describe, expect, it } from "vitest";
import {
  BCS_PRIORITIES,
  derivePriorities,
  parsePriorities,
  priorityOf,
  resolvePriorities,
} from "@/lib/routine-priorities";

/**
 * Priority structure must be configuration, not code. These tests pin the
 * resolution order — admin config, then the routine's own labels, then the BCS
 * default — because getting it wrong silently files a Petrobangla topic under
 * "P1 Main" and shows a student the wrong plan.
 */

describe("parsePriorities (admin configuration)", () => {
  it("reads metadata.priorities into definitions", () => {
    const parsed = parsePriorities({
      priorities: [
        { badge: "E", label: "Electrical Engineering", match: "Electrical Engineering" },
        { badge: "El", label: "Electronics" },
      ],
    });
    expect(parsed).toHaveLength(2);
    expect(parsed?.[0]).toMatchObject({ key: "p1", badge: "E", label: "Electrical Engineering" });
    // `match` falls back to the badge when the config omits it
    expect(parsed?.[1].match).toBe("El");
  });

  it("returns null rather than guessing at malformed config", () => {
    expect(parsePriorities(null)).toBeNull();
    expect(parsePriorities({})).toBeNull();
    expect(parsePriorities({ priorities: [] })).toBeNull();
    expect(parsePriorities({ priorities: "P1,P2" })).toBeNull();
    // missing label — dropped, not invented
    expect(parsePriorities({ priorities: [{ badge: "P1" }] })).toBeNull();
  });

  it("caps at four priorities", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ badge: `P${i + 1}`, label: `L${i}` }));
    expect(parsePriorities({ priorities: many })).toHaveLength(4);
  });
});

describe("derivePriorities (from the routine's own slot labels)", () => {
  it("reads the name before the clock slot", () => {
    const derived = derivePriorities([
      "Electrical Engineering · সকাল ৭:০০–৯:৩০",
      "Electronics · সকাল ১০:০০",
      "Power Systems · বিকাল ৫:০০",
    ]);
    expect(derived?.map((p) => p.label)).toEqual([
      "Electrical Engineering",
      "Electronics",
      "Power Systems",
    ]);
  });

  it("keeps the P1/P2 badge but strips it from the label", () => {
    const derived = derivePriorities(["P1 Main · সকাল ৭:০০", "P2 Second · সকাল ১০:০০"]);
    expect(derived?.[0]).toMatchObject({ badge: "P1", label: "Main" });
    expect(derived?.[1]).toMatchObject({ badge: "P2", label: "Second" });
  });

  it("skips assessment blocks — MCQ is not a study priority", () => {
    const derived = derivePriorities([
      "P1 Main · সকাল ৭:০০",
      "MCQ ও ভুল বিশ্লেষণ · রাত ৮:০০",
      "রিভিশন · রাত ৯:০০",
    ]);
    expect(derived).toHaveLength(1);
    expect(derived?.[0].label).toBe("Main");
  });

  it("returns null when there is nothing to derive from", () => {
    expect(derivePriorities([])).toBeNull();
    expect(derivePriorities([null, ""])).toBeNull();
    expect(derivePriorities(["MCQ · রাত ৮:০০"])).toBeNull();
  });
});

describe("resolvePriorities", () => {
  it("prefers admin configuration over the slots", () => {
    const { priorities, source } = resolvePriorities(
      { priorities: [{ badge: "G", label: "General Knowledge" }] },
      ["P1 Main · সকাল ৭:০০"],
    );
    expect(source).toBe("configured");
    expect(priorities[0].label).toBe("General Knowledge");
  });

  it("falls back to the slots when no configuration exists", () => {
    const { priorities, source } = resolvePriorities(null, ["Electrical Engineering · সকাল ৭:০০"]);
    expect(source).toBe("slots");
    expect(priorities[0].label).toBe("Electrical Engineering");
  });

  it("falls back to BCS only when there is neither", () => {
    const { priorities, source } = resolvePriorities(null, [null, null]);
    expect(source).toBe("default");
    expect(priorities).toBe(BCS_PRIORITIES);
  });
});

describe("priorityOf", () => {
  it("files a row by the prefix of its slot label", () => {
    expect(priorityOf("P1 Main · সকাল ৭:০০", BCS_PRIORITIES)).toBe("p1");
    expect(priorityOf("P2 Second · সকাল ১০:০০", BCS_PRIORITIES)).toBe("p2");
    expect(priorityOf("P3/P4 Third · বিকাল ৫:০০", BCS_PRIORITIES)).toBe("p3");
  });

  it("returns null for assessment rows and missing labels", () => {
    expect(priorityOf("MCQ ও ভুল বিশ্লেষণ · রাত ৮:০০", BCS_PRIORITIES)).toBeNull();
    expect(priorityOf(null, BCS_PRIORITIES)).toBeNull();
  });

  it("does not force an unrelated course into a BCS slot", () => {
    const priorities = derivePriorities(["Power Systems · বিকাল ৫:০০"])!;
    expect(priorityOf("Power Systems · বিকাল ৫:০০", priorities)).toBe("p1");
    expect(priorityOf("P1 Main · সকাল ৭:০০", priorities)).toBeNull();
  });
});
