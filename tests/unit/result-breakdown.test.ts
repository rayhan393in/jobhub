import { describe, expect, it } from "vitest";
import {
  computeSubjectBreakdown, computeTopicBreakdown, weakTopics, type BreakdownInput,
} from "@/lib/result-breakdown";

const MAIN = "subject-main";
const SECONDARY = "subject-secondary";

function item(
  subject: string, topic: string, state: "correct" | "wrong" | "blank",
): BreakdownInput {
  return {
    subject_id: subject,
    topic_id: topic,
    selected_option: state === "blank" ? null : state === "correct" ? 1 : 2,
    is_correct: state === "correct",
  };
}

describe("computeSubjectBreakdown", () => {
  // A miniature 90:10 paper: 9 main + 1 secondary.
  const items: BreakdownInput[] = [
    ...Array.from({ length: 6 }, () => item(MAIN, "t1", "correct")),
    ...Array.from({ length: 2 }, () => item(MAIN, "t2", "wrong")),
    item(MAIN, "t2", "blank"),
    item(SECONDARY, "t9", "correct"),
  ];

  it("splits main and secondary sections with correct marks (+1, −0.5)", () => {
    const sections = computeSubjectBreakdown(items, {
      positiveMarks: 1, negativeMarks: 0.5, mainSubjectId: MAIN, secondarySubjectId: SECONDARY,
    });
    expect(sections).toHaveLength(2);
    const [main, secondary] = sections;
    expect(main).toMatchObject({ id: MAIN, role: "main", total: 9, correct: 6, wrong: 2, unanswered: 1 });
    expect(main.marks).toBe(5); // 6 − 2×0.5
    expect(main.maxMarks).toBe(9);
    expect(secondary).toMatchObject({ id: SECONDARY, role: "secondary", total: 1, correct: 1, marks: 1 });
  });

  it("unanswered questions cost nothing (0 marks, not negative)", () => {
    const sections = computeSubjectBreakdown(
      [item(MAIN, "t1", "blank"), item(MAIN, "t1", "blank")],
      { positiveMarks: 1, negativeMarks: 0.5, mainSubjectId: MAIN },
    );
    expect(sections[0].marks).toBe(0);
    expect(sections[0].unanswered).toBe(2);
  });

  it("main section always sorts first regardless of size", () => {
    const sections = computeSubjectBreakdown(
      [item(SECONDARY, "t9", "correct"), item(SECONDARY, "t9", "correct"), item(MAIN, "t1", "correct")],
      { positiveMarks: 1, negativeMarks: 0, mainSubjectId: MAIN, secondarySubjectId: SECONDARY },
    );
    expect(sections[0].id).toBe(MAIN);
  });

  it("accuracy counts only attempted questions", () => {
    const sections = computeSubjectBreakdown(
      [item(MAIN, "t1", "correct"), item(MAIN, "t1", "wrong"), item(MAIN, "t1", "blank")],
      { positiveMarks: 1, negativeMarks: 0 },
    );
    expect(sections[0].accuracy).toBe(50);
  });
});

describe("computeTopicBreakdown + weakTopics", () => {
  const items: BreakdownInput[] = [
    item(MAIN, "strong", "correct"), item(MAIN, "strong", "correct"), item(MAIN, "strong", "correct"),
    item(MAIN, "weak", "wrong"), item(MAIN, "weak", "blank"), item(MAIN, "weak", "correct"),
    item(MAIN, "tiny", "wrong"), // only 1 question — not enough to call weak
  ];

  it("groups per topic with unanswered tracked separately", () => {
    const topics = computeTopicBreakdown(items);
    const weak = topics.find((topic) => topic.id === "weak");
    expect(weak).toMatchObject({ total: 3, correct: 1, wrong: 1, unanswered: 1 });
  });

  it("flags <60% topics with ≥2 questions, weakest first, and skips single-question topics", () => {
    const flagged = weakTopics(computeTopicBreakdown(items));
    expect(flagged.map((topic) => topic.id)).toEqual(["weak"]);
  });

  it("ignores items without a topic", () => {
    const topics = computeTopicBreakdown([{ subject_id: MAIN, topic_id: null, selected_option: 1, is_correct: true }]);
    expect(topics).toHaveLength(0);
  });
});
