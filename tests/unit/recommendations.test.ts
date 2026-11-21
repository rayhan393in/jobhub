import { describe, expect, it } from "vitest";
import { buildRecommendations, summariseRecommendations } from "@/lib/routines/recommendations";

const topic = (id: string, extra: Partial<Parameters<typeof buildRecommendations>[0]["frequency"][number]> = {}) => ({
  topic_id: id,
  topic_bn: `টপিক ${id}`,
  subject_id: "s1",
  subject_bn: "বাংলা",
  ...extra,
});

const base = {
  frequency: [],
  attempts: [],
  unfinishedTopicIds: [],
  completedTopicIds: [],
  lastResult: null,
};

describe("buildRecommendations", () => {
  it("says nothing and explains why when there is no data at all", () => {
    const set = buildRecommendations(base);
    expect(set.empty).toBe(true);
    expect(set.items).toHaveLength(0);
    expect(set.blocked.map((b) => b.kind).sort()).toEqual(["carry_forward", "frequency", "improve", "weak"]);
  });

  it("never calls a topic weak on one answered question", () => {
    const set = buildRecommendations({
      ...base,
      frequency: [topic("t1")],
      attempts: [{ topic_id: "t1", attempted: 1, correct: 0 }],
    });
    expect(set.items).toHaveLength(0);
    expect(set.blocked.some((b) => b.kind === "weak")).toBe(true);
  });

  it("marks a topic weak only after three answered questions under 60%", () => {
    const set = buildRecommendations({
      ...base,
      frequency: [topic("t1", { frequency: 9, papers: 3, band: "high" })],
      attempts: [{ topic_id: "t1", attempted: 4, correct: 1 }],
    });
    const item = set.items.find((i) => i.kind === "weak");
    expect(item).toBeDefined();
    expect(item!.evidence_bn).toContain("25%");
    expect(item!.evidence_bn).toContain("9টি প্রশ্ন");
  });

  it("does not recommend frequency topics it has never counted", () => {
    const set = buildRecommendations({
      ...base,
      frequency: [topic("t1", { band: "high" })],
    });
    expect(set.items).toHaveLength(0);
    expect(set.blocked.find((b) => b.kind === "frequency")?.reason_bn).toContain("গণনা করা হয়নি");
  });

  it("puts carried-forward topics ahead of everything else", () => {
    const set = buildRecommendations({
      ...base,
      frequency: [topic("t1", { frequency: 40, papers: 8, band: "high" })],
      unfinishedTopicIds: ["t2"],
    });
    expect(set.items[0].topic_id).toBe("t2");
    expect(set.items[0].kind).toBe("carry_forward");
  });

  it("drops topics that are already completed", () => {
    const set = buildRecommendations({
      ...base,
      frequency: [topic("t1", { frequency: 40, papers: 8, band: "high" })],
      unfinishedTopicIds: ["t1"],
      completedTopicIds: ["t1"],
    });
    expect(set.items).toHaveLength(0);
  });

  it("skips a high-frequency topic the student is already strong on", () => {
    const set = buildRecommendations({
      ...base,
      frequency: [topic("t1", { frequency: 40, papers: 8, band: "high" })],
      attempts: [{ topic_id: "t1", attempted: 10, correct: 9 }],
    });
    expect(set.items).toHaveLength(0);
  });

  it("keeps one row per topic, preferring the stronger reason", () => {
    const set = buildRecommendations({
      ...base,
      frequency: [topic("t1", { frequency: 40, papers: 8, band: "high" })],
      attempts: [{ topic_id: "t1", attempted: 5, correct: 0 }],
    });
    expect(set.items).toHaveLength(1);
    expect(set.items[0].kind).toBe("weak");
  });

  it("surfaces the missing result as a blocked rule, not a fake tip", () => {
    const set = buildRecommendations({
      ...base,
      frequency: [topic("t1", { frequency: 5, papers: 2, band: "high" })],
    });
    expect(set.blocked.find((b) => b.kind === "improve")).toBeDefined();
  });

  it("summarises only the kinds it actually produced", () => {
    const set = buildRecommendations({
      ...base,
      frequency: [topic("t1", { frequency: 40, papers: 8, band: "high" })],
    });
    expect(summariseRecommendations(set)).toBe("1টি বেশি-চাহিদার টপিক।");
  });
});
