import { describe, expect, it } from "vitest";
import { type Schedule, sortForStudent } from "@/components/exam/exam-center-client";

const NOW = Date.parse("2026-12-10T12:00:00Z");
const HOUR = 3_600_000;

function schedule(id: string, startOffsetHours: number, lengthHours = 1, status = "published"): Schedule {
  const starts = NOW + startOffsetHours * HOUR;
  return {
    id,
    course_id: "c",
    kind: "daily_live",
    title_en: id,
    title_bn: id,
    starts_at: new Date(starts).toISOString(),
    ends_at: new Date(starts + lengthHours * HOUR).toISOString(),
    result_release_at: new Date(starts + lengthHours * HOUR).toISOString(),
    duration_minutes: 60,
    question_count: 100,
    total_marks: 100,
    positive_marks: 1,
    negative_marks: 0.5,
    status,
    routine_id: null,
    settings: {},
    published_at: null,
  } as unknown as Schedule;
}

describe("exam centre ordering", () => {
  it("puts a running exam first even when closed exams came earlier", () => {
    // The API returns starts_at ascending, so the closed ones come first.
    const list = [
      schedule("closed-2d", -48, 1), // closed two days ago
      schedule("closed-1d", -24, 1), // closed yesterday
      schedule("running", -0.5, 1), // live right now
      schedule("soon", 3), // upcoming
      schedule("later", 30), // upcoming
    ];
    expect(sortForStudent(list, NOW).map((s) => s.id)).toEqual([
      "running",
      "soon",
      "later",
      "closed-1d",
      "closed-2d",
    ]);
  });

  it("orders upcoming soonest-first and finished newest-first", () => {
    const list = [schedule("a", 72), schedule("b", 2), schedule("c", -100), schedule("d", -1)];
    expect(sortForStudent(list, NOW).map((s) => s.id)).toEqual(["b", "a", "d", "c"]);
  });

  it("leaves drafts out of the running slot and keeps the input untouched", () => {
    const list = [schedule("draft", -0.5, 1, "draft"), schedule("running", -0.5, 1)];
    const input = [...list];
    const out = sortForStudent(list, NOW);
    expect(out.map((s) => s.id)).toEqual(["running", "draft"]);
    expect(list).toEqual(input);
  });
});
