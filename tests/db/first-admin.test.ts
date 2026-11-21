import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, actAsService, createDatabase, expectError, migrate, uuid } from "./harness";

/**
 * The first-admin seat is the one place where a normal user may gain a
 * privileged role. These tests pin down the boundaries: it works exactly once,
 * never for anonymous visitors, and never after staff already exist.
 */

const FIRST = uuid(1);
const SECOND = uuid(2);
const ADMIN = uuid(3);

let db: PGlite;

async function scalar<T>(sql: string, params: unknown[] = []): Promise<T> {
  const result = await db.query<T>(sql, params);
  return Object.values(result.rows[0] as Record<string, unknown>)[0] as T;
}

async function claim(userId: string) {
  await actAs(db, userId);
  const result = await db.query<{ jh_claim_first_admin: { claimed: boolean; already_staff: boolean; role: string } }>(
    `select public.jh_claim_first_admin()`,
  );
  return result.rows[0].jh_claim_first_admin;
}

beforeAll(async () => {
  db = await createDatabase();
  await migrate(db);

  await actAsService(db);
  for (const [id, email] of [
    [FIRST, "first@example.com"],
    [SECOND, "second@example.com"],
    [ADMIN, "admin@example.com"],
  ] as const) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  }
});

afterAll(async () => {
  await db?.close();
});

describe("first admin claim", () => {
  it("reports the seat as open on a fresh platform", async () => {
    await actAs(db, FIRST);
    expect(await scalar<boolean>(`select public.jh_admin_seat_available()`)).toBe(true);

    await actAsService(db);
    expect(await scalar<number>(`select count(*)::int from public.profiles where role_id <> 'student'`)).toBe(0);
  });

  it("refuses anonymous callers", async () => {
    await actAs(db, null, "anon");
    const message = await expectError(db.query(`select public.jh_claim_first_admin()`));
    expect(message).toMatch(/permission denied|not authorized/i);
  });

  it("promotes the first caller to super_admin and records an audit entry", async () => {
    const result = await claim(FIRST);
    expect(result.claimed).toBe(true);
    expect(result.role).toBe("super_admin");

    await actAsService(db);
    expect(await scalar<string>(`select role_id from public.profiles where id = $1`, [FIRST])).toBe("super_admin");
    expect(
      await scalar<number>(
        `select count(*)::int from public.audit_logs
          where entity_id = $1 and details->>'source' = 'jh_claim_first_admin'`,
        [FIRST],
      ),
    ).toBe(1);
  });

  it("closes the seat for everyone else", async () => {
    await actAs(db, SECOND);
    expect(await scalar<boolean>(`select public.jh_admin_seat_available()`)).toBe(false);

    const message = await expectError(db.query(`select public.jh_claim_first_admin()`));
    expect(message).toMatch(/administrator already exists/i);

    await actAsService(db);
    expect(await scalar<string>(`select role_id from public.profiles where id = $1`, [SECOND])).toBe("student");
  });

  it("is idempotent for the existing super admin", async () => {
    const result = await claim(FIRST);
    expect(result.claimed).toBe(false);
    expect(result.already_staff).toBe(true);
    expect(result.role).toBe("super_admin");
  });

  it("never demotes or duplicates staff once the platform is live", async () => {
    // A second super admin added deliberately through the normal staff flow is
    // unaffected by the claim helper.
    await actAsService(db);
    await db.query(`update public.profiles set role_id = 'admin' where id = $1`, [ADMIN]);

    await actAs(db, SECOND);
    const message = await expectError(db.query(`select public.jh_claim_first_admin()`));
    expect(message).toMatch(/administrator already exists/i);

    await actAsService(db);
    expect(await scalar<number>(`select count(*)::int from public.profiles where role_id = 'super_admin'`)).toBe(1);
  });

  it("grants the same permissions as a normal super admin", async () => {
    await actAs(db, FIRST);
    // Every capability in the matrix, including the role manager itself.
    for (const key of [
      "question.review",
      "question.import",
      "taxonomy.manage",
      "routine.manage",
      "exam.publish",
      "attempt.inspect",
      "student.manage",
      "analytics.view",
      "audit.view",
      "settings.manage",
      "role.manage",
    ]) {
      expect(await scalar<boolean>(`select public.jh_has_permission($1)`, [key]), key).toBe(true);
    }
  });
});
