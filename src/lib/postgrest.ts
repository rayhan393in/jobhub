/**
 * PostgREST embedded resources (`alias:table(column)`) come back as objects
 * (e.g. `{ title_bn: "…" }`) or arrays of objects — never plain strings.
 * Rendering those objects directly as React children crashes the page
 * (this broke the production homepage on 2026-11-21), so every query that
 * aliases an embed to a `*_title_bn` string field must flatten it through
 * this helper first.
 */
export function flattenEmbeddedTitle(value: unknown): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (v && typeof v === "object" && "title_bn" in v) {
    const title = (v as { title_bn: unknown }).title_bn;
    return typeof title === "string" ? title : null;
  }
  return typeof v === "string" ? v : null;
}
