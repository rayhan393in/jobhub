/**
 * Course-specific priority structure.
 *
 * Not every course is BCS. A Petrobangla paper groups its days by technical
 * subject, a Written course groups them by paper, and a bank-exam course may
 * want nothing but "Spotlight". Hardcoding P1/P2/P3 would therefore force every
 * other course into the BCS mould.
 *
 * The resolution order is:
 *
 *   1. `courses.metadata.priorities` — a JSON array an administrator edits. This
 *      is the real configuration path and needs no deploy.
 *   2. Slot labels actually present in the course's published routine. A plan
 *      imported as "Electrical Engineering · সকাল ৭:০০" gets an Electrical
 *      Engineering plate without anyone touching a config screen.
 *   3. A single neutral plate, so a course with unlabelled rows still renders.
 *
 * Nothing here invents a priority: an unrecognised course gets whatever labels
 * its own rows carry.
 */

export type PriorityKey = "p1" | "p2" | "p3" | "p4";

export type PriorityDef = {
  /** Stable slot key used to group routine rows. */
  key: PriorityKey;
  /** Short badge, e.g. "P1". */
  badge: string;
  /** Plate name, e.g. "Main" / "Electrical Engineering". */
  label: string;
  /** Prefix a routine row's `slot_label` must start with to land in this plate. */
  match: string;
};

/** The BCS Preliminary structure, and the default when nothing else is known. */
export const BCS_PRIORITIES: PriorityDef[] = [
  { key: "p1", badge: "P1", label: "Main", match: "P1 Main" },
  { key: "p2", badge: "P2", label: "Second", match: "P2 Second" },
  { key: "p3", badge: "P3/P4", label: "Third", match: "P3/P4 Third" },
];

const KEYS: PriorityKey[] = ["p1", "p2", "p3", "p4"];

/**
 * Read `metadata.priorities` into a definition list.
 *
 * Accepts `{ badge, label, match }` objects. Anything malformed is dropped
 * rather than guessed at — a half-parsed priority would silently mis-group a
 * day's work, which is worse than falling back to the slot labels.
 */
export function parsePriorities(metadata: unknown): PriorityDef[] | null {
  const config = (metadata as { priorities?: unknown } | null)?.priorities;
  if (!Array.isArray(config) || config.length === 0) return null;

  const parsed: PriorityDef[] = [];
  config.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const { badge, label, match } = entry as Record<string, unknown>;
    if (typeof badge !== "string" || typeof label !== "string") return;
    const key = KEYS[parsed.length];
    if (!key) return;
    parsed.push({
      key,
      badge: badge.trim(),
      label: label.trim(),
      match: typeof match === "string" && match.trim() ? match.trim() : badge.trim(),
    });
  });

  return parsed.length > 0 ? parsed : null;
}

/**
 * Derive a structure from the slot labels the routine itself uses.
 *
 * `slot_label` reads like `"P1 Main · সকাল ৭:০০–৯:৩০"` or
 * `"Electrical Engineering · সকাল ৭:০০"`, so the part before the first `·` is
 * the priority name. Session blocks (MCQ, revision, exam) are skipped: they are
 * assessment, not study priority, and they live in their own strip.
 */
export function derivePriorities(slotLabels: (string | null)[]): PriorityDef[] | null {
  const seen = new Set<string>();
  const derived: PriorityDef[] = [];

  for (const raw of slotLabels) {
    if (!raw) continue;
    const name = raw.split("·")[0]?.trim();
    if (!name || seen.has(name)) continue;
    // Assessment blocks are not study priorities.
    if (/^(MCQ|রিভিশন|পরীক্ষা|Revision|Exam)/i.test(name)) continue;
    const key = KEYS[derived.length];
    if (!key) break;
    seen.add(name);
    const badge = name.match(/^(P\d(?:\/P\d)?)/)?.[1];
    derived.push({
      key,
      badge: badge ?? name.slice(0, 2),
      label: badge ? name.slice(badge.length).trim() || name : name,
      match: name,
    });
  }

  return derived.length > 0 ? derived : null;
}

/** True when the row's slot label belongs to this priority. */
export function priorityOf(slotLabel: string | null, priorities: PriorityDef[]): PriorityKey | null {
  if (!slotLabel) return null;
  const hit = priorities.find((priority) => slotLabel.startsWith(priority.match));
  return hit ? hit.key : null;
}

/**
 * Resolve the structure for one course, most specific source first.
 * The boolean tells the caller where it came from, so the UI can be honest
 * about a fallback instead of claiming a configured structure.
 */
export function resolvePriorities(
  metadata: unknown,
  slotLabels: (string | null)[],
): { priorities: PriorityDef[]; source: "configured" | "slots" | "default" } {
  const configured = parsePriorities(metadata);
  if (configured) return { priorities: configured, source: "configured" };
  const derived = derivePriorities(slotLabels);
  if (derived) return { priorities: derived, source: "slots" };
  return { priorities: BCS_PRIORITIES, source: "default" };
}
