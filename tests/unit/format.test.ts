import { describe, expect, it } from "vitest";
import {
  dhakaDateKey, formatClock, formatNumber, formatPercent, toBengaliDigits,
} from "@/lib/format";

describe("Bengali number formatting", () => {
  it("converts every digit and keeps separators", () => {
    expect(toBengaliDigits("2026-11-21")).toBe("২০২৬-১১-২১");
    expect(toBengaliDigits(0)).toBe("০");
    expect(toBengaliDigits(-12.5)).toBe("-১২.৫");
  });

  it("formats numbers per locale", () => {
    expect(formatNumber(1234)).toBe("১২৩৪");
    expect(formatNumber(1234, "en")).toBe("1234");
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(Number.NaN)).toBe("—");
  });

  it("rounds to two decimals without trailing zeroes", () => {
    expect(formatNumber(12.5)).toBe("১২.৫");
    expect(formatNumber(12.345)).toBe("১২.৩৫");
    expect(formatNumber(20.0)).toBe("২০");
  });

  it("formats percentages with one decimal", () => {
    expect(formatPercent(50)).toBe("৫০.০%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("timer clock", () => {
  it("formats mm:ss and hh:mm:ss", () => {
    expect(formatClock(0)).toBe("০০:০০");
    expect(formatClock(59)).toBe("০০:৫৯");
    expect(formatClock(60)).toBe("০১:০০");
    expect(formatClock(3600)).toBe("০১:০০:০০");
    expect(formatClock(3725)).toBe("০১:০২:০৫");
  });

  it("never renders a negative clock", () => {
    expect(formatClock(-30)).toBe("০০:০০");
  });
});

describe("Dhaka date key", () => {
  it("uses the Asia/Dhaka calendar day, not UTC", () => {
    // 2026-11-20T19:30Z is already 2026-11-21 01:30 in Dhaka (UTC+6).
    expect(dhakaDateKey(new Date("2026-11-20T19:30:00Z"))).toBe("2026-11-21");
    // 2026-11-21T17:00Z is 2026-11-21 23:00 in Dhaka.
    expect(dhakaDateKey(new Date("2026-11-21T17:00:00Z"))).toBe("2026-11-21");
    // 2026-11-21T18:30Z rolls over to the 22nd in Dhaka.
    expect(dhakaDateKey(new Date("2026-11-21T18:30:00Z"))).toBe("2026-11-22");
  });
});
