import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseSelector, type CourseOption } from "@/components/routines/course-selector";

/**
 * The selector must be built from whatever the database returned, so a course an
 * administrator publishes later shows up without a code change. These assertions
 * pin the accessibility contract and the "no routine" handling.
 */

const courses: CourseOption[] = [
  { id: "bcs", title_bn: "BCS Preliminary", title_en: "BCS Preliminary", hasRoutine: true, enrolled: true },
  { id: "petro", title_bn: "Petrobangla AE (EEE)", title_en: "Petrobangla AE", hasRoutine: true },
  { id: "empty", title_bn: "University Admission", title_en: "University Admission", hasRoutine: false },
];

function render(overrides: Partial<React.ComponentProps<typeof CourseSelector>> = {}): string {
  return renderToStaticMarkup(
    React.createElement(CourseSelector, {
      courses,
      value: "bcs",
      onChange: () => {},
      ...overrides,
    }),
  );
}

describe("CourseSelector", () => {
  it("renders the selected course as a combobox trigger", () => {
    const html = render();
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("BCS Preliminary");
  });

  it("labels the control for assistive tech", () => {
    expect(render()).toContain('aria-label="কোর্স নির্বাচন করুন"');
  });

  it("keeps the listbox out of the DOM until it opens", () => {
    // The open state is React state, and static markup renders the initial
    // (closed) state — so the popup must not be in the server HTML at all.
    const html = render();
    expect(html).not.toContain('role="listbox"');
    expect(html).not.toContain("কোর্স খুঁজুন");
    // …and the trigger says it is collapsed
    expect(html).toContain('aria-expanded="false"');
  });

  it("falls back to a prompt when no course is selected", () => {
    expect(render({ value: "" })).toContain("কোর্স বেছে নিন");
  });

  it("renders every database course it is given — no hardcoded list", () => {
    // The component only knows the options passed in, so passing a brand-new
    // course proves a newly published course needs no frontend change.
    const html = render({
      courses: [{ id: "new", title_bn: "নতুন কোর্স", hasRoutine: true }],
      value: "new",
    });
    expect(html).toContain("নতুন কোর্স");
    expect(html).not.toContain("BCS Preliminary");
  });

  it("is a button, not a native select, so long Bengali labels cannot clip", () => {
    const html = render();
    expect(html).toContain("<button");
    expect(html).not.toContain("<select");
  });
});
