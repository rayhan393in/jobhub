import { describe, expect, it } from "vitest";
import { flattenEmbeddedTitle } from "@/lib/postgrest";

/**
 * Regression test for the production homepage crash (2026-11-21).
 *
 * PostgREST embeds aliased like `subject_title_bn:subjects(title_bn)` return
 * OBJECTS (`{ title_bn: "…" }`) — not strings. Components rendered those
 * objects directly as React children, which crashed every page that showed a
 * published routine (landing page, admin routine manager, student routines).
 * `flattenEmbeddedTitle` must collapse every shape PostgREST can return into
 * `string | null`.
 */
describe("flattenEmbeddedTitle", () => {
  it("unwraps a to-one embedded object", () => {
    expect(flattenEmbeddedTitle({ title_bn: "বাংলা ভাষা ও সাহিত্য" })).toBe("বাংলা ভাষা ও সাহিত্য");
  });

  it("unwraps an array-shaped embed (to-many fallback)", () => {
    expect(flattenEmbeddedTitle([{ title_bn: "গাণিতিক যুক্তি" }])).toBe("গাণিতিক যুক্তি");
  });

  it("passes plain strings through unchanged", () => {
    expect(flattenEmbeddedTitle("English Language & Literature")).toBe("English Language & Literature");
  });

  it("returns null for null, undefined and empty arrays", () => {
    expect(flattenEmbeddedTitle(null)).toBeNull();
    expect(flattenEmbeddedTitle(undefined)).toBeNull();
    expect(flattenEmbeddedTitle([])).toBeNull();
  });

  it("returns null when title_bn is missing or not a string", () => {
    expect(flattenEmbeddedTitle({})).toBeNull();
    expect(flattenEmbeddedTitle({ title_bn: 42 })).toBeNull();
    expect(flattenEmbeddedTitle({ title_bn: null })).toBeNull();
    expect(flattenEmbeddedTitle(7)).toBeNull();
  });

  it("never returns something React would render as [object Object]", () => {
    const shapes: unknown[] = [
      { title_bn: "ধ্বনি ও বর্ণ" },
      [{ title_bn: "ধ্বনি ও বর্ণ" }],
      "ধ্বনি ও বর্ণ",
      null,
      undefined,
      [],
      {},
    ];
    for (const shape of shapes) {
      const result = flattenEmbeddedTitle(shape);
      expect(result === null || typeof result === "string").toBe(true);
    }
  });
});
