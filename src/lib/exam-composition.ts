/**
 * Composition maths for the custom-exam builder.
 *
 * Kept out of the React component so the one part that can silently produce the
 * wrong number of questions — splitting a requested count across several
 * selected subjects/topics/subtopics — is unit-testable.
 */

export type CompositionScope = {
  kind: "subject" | "topic" | "subtopic";
  id: string;
  available: number | null;
};

export type CompositionItem = {
  subject_id?: string;
  topic_id?: string;
  subtopic_id?: string;
  count: number;
};

const ID_FIELD = {
  subject: "subject_id",
  topic: "topic_id",
  subtopic: "subtopic_id",
} as const;

/**
 * Distribute `count` questions across the selected scopes in proportion to how
 * many verified questions each one actually has, so a 40-question paper built
 * from a 300-question topic and a 10-question subtopic does not try to pull 20
 * from the subtopic and fail.
 *
 * Guarantees:
 *  - the returned counts sum to exactly `count` whenever the pool allows it;
 *  - no item asks for more than its pool (`available`), so the database call
 *    cannot come up short and raise;
 *  - every selected scope keeps at least one question while the pool allows it,
 *    because the user explicitly picked it.
 */
export function splitComposition(scopes: CompositionScope[], count: number): CompositionItem[] {
  const pools = scopes.map((scope) => ({
    field: ID_FIELD[scope.kind],
    id: scope.id,
    pool: Math.max(0, scope.available ?? 0),
  }));

  const totalPool = pools.reduce((sum, item) => sum + item.pool, 0);
  if (totalPool === 0) return [];

  const requested = Math.max(1, Math.min(count, totalPool));

  // Seed with one question each (where the pool allows), then hand out the rest
  // by proportion. Seeding first is what keeps a tiny 3-question topic in the
  // paper instead of rounding it away to zero.
  const allocation: number[] = pools.map((item) => (item.pool > 0 ? 1 : 0));
  let assigned = allocation.reduce((sum, value) => sum + value, 0);

  // If the requested count is smaller than the number of selected scopes, trim
  // the tail rather than over-allocating.
  if (assigned > requested) {
    let excess = assigned - requested;
    for (let index = allocation.length - 1; index >= 0 && excess > 0; index -= 1) {
      while (allocation[index] > 0 && excess > 0) {
        allocation[index] -= 1;
        excess -= 1;
      }
    }
    assigned = allocation.reduce((sum, value) => sum + value, 0);
  }

  // Hand out what is left one question at a time, always to the scope whose
  // filled fraction is lowest and which still has room. A rounded proportional
  // pass leaves a remainder that cannot be placed (its "free" slots belong to
  // scopes that are already full), which is how the paper silently came up one
  // question short; this loop cannot: `remaining` never exceeds the free
  // capacity, so it always terminates at zero.
  let remaining = requested - assigned;

  while (remaining > 0) {
    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestCapacity = 0;

    for (let index = 0; index < pools.length; index += 1) {
      const capacity = pools[index].pool - allocation[index];
      if (capacity <= 0) continue;
      const score = allocation[index] / pools[index].pool;
      if (score < bestScore || (score === bestScore && capacity > bestCapacity)) {
        bestIndex = index;
        bestScore = score;
        bestCapacity = capacity;
      }
    }

    if (bestIndex === -1) break;
    allocation[bestIndex] += 1;
    remaining -= 1;
  }

  return pools
    .map((item, index) => ({
      [item.field]: item.id,
      count: allocation[index],
    })) as CompositionItem[];
}
