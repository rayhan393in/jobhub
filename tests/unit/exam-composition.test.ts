import { describe, expect, it } from "vitest";
import { splitComposition, type CompositionScope } from "@/lib/exam-composition";

/**
 * The builder lets a student pick several subjects/topics/subtopics at once.
 * These tests pin the promise that the counts always add up to the number of
 * questions the student asked for — and never ask a single scope for more
 * questions than it actually has, which would make `jh_select_questions` raise.
 */

function pool(pairs: Array<["subject" | "topic" | "subtopic", number]>): CompositionScope[] {
  return pairs.map(([kind, available], index) => ({
    kind,
    id: `00000000-0000-4000-8000-00000000000${index}`,
    available,
  }));
}

const sum = (items: ReturnType<typeof splitComposition>) =>
  items.reduce((total, item) => total + item.count, 0);

describe("splitComposition", () => {
  it("gives everything to a single scope", () => {
    expect(splitComposition(pool([["topic", 50]]), 20)).toEqual([
      { topic_id: "00000000-0000-4000-8000-000000000000", count: 20 },
    ]);
  });

  it("splits in proportion to each verified pool", () => {
    const items = splitComposition(pool([["subject", 300], ["topic", 100]]), 40);
    expect(sum(items)).toBe(40);
    expect(items[0].count).toBe(30);
    expect(items[1].count).toBe(10);
  });

  it("uses the right id field for each level", () => {
    const items = splitComposition(pool([["subject", 10], ["topic", 10], ["subtopic", 10]]), 12);
    expect(items[0]).toHaveProperty("subject_id");
    expect(items[1]).toHaveProperty("topic_id");
    expect(items[2]).toHaveProperty("subtopic_id");
  });

  it("never asks for more than a scope holds", () => {
    const items = splitComposition(pool([["topic", 500], ["subtopic", 3]]), 40);
    expect(sum(items)).toBe(40);
    expect(items[1].count).toBeLessThanOrEqual(3);
  });

  it("keeps a tiny scope in the paper instead of rounding it to zero", () => {
    const items = splitComposition(pool([["topic", 400], ["subtopic", 2]]), 20);
    expect(items[1].count).toBeGreaterThanOrEqual(1);
    expect(sum(items)).toBe(20);
  });

  it("caps the paper at the total verified pool", () => {
    const items = splitComposition(pool([["topic", 5], ["topic", 7]]), 100);
    expect(sum(items)).toBe(12);
  });

  it("trims scopes when fewer questions than scopes are requested", () => {
    const items = splitComposition(pool([["topic", 10], ["topic", 10], ["topic", 10]]), 2);
    expect(sum(items)).toBe(2);
    expect(items.filter((item) => item.count > 0)).toHaveLength(2);
  });

  it("returns nothing when no verified questions exist", () => {
    expect(splitComposition(pool([["topic", 0], ["subtopic", 0]]), 20)).toEqual([]);
  });

  it("always sums to the request for awkward ratios", () => {
    for (const scopes of [
      pool([["topic", 7], ["topic", 11], ["topic", 13]]),
      pool([["subject", 1], ["subject", 199]]),
      pool([["topic", 3], ["topic", 3], ["topic", 3], ["topic", 3], ["topic", 3]]),
    ]) {
      for (const count of [1, 2, 5, 17, 40, 100]) {
        const items = splitComposition(scopes, count);
        const cap = Math.min(
          count,
          scopes.reduce((total, scope) => total + (scope.available ?? 0), 0),
        );
        expect(sum(items)).toBe(cap);
        items.forEach((item, index) => {
          expect(item.count).toBeLessThanOrEqual(scopes[index].available ?? 0);
        });
      }
    }
  });
});
