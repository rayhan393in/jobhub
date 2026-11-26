import { describe, expect, it, beforeAll } from "vitest";
import { createDatabase, migrate, rows, actAsService } from "../db/harness";
import type { PGlite } from "@electric-sql/pglite";

let db: PGlite;
beforeAll(async () => { db = await createDatabase(); await migrate(db); }, 120_000);

async function anonExec() {
  await actAsService(db);
  const r = await rows<{ proname: string }>(
    db,
    `select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname like 'jh\\_%' escape '\\'
       and has_function_privilege('anon', p.oid, 'execute') order by 1`,
  );
  return r.map((x) => x.proname);
}

describe("anon lockdown", () => {
  it("leaves exactly the two intended public helpers", async () => {
    expect(await anonExec()).toEqual(["jh_admin_seat_available", "jh_public_question_count"]);
  });

  it("keeps authenticated able to call the two locked functions", async () => {
    await actAsService(db);
    const r = await rows<{ n: string; ok: boolean }>(
      db,
      `select p.proname as n, has_function_privilege('authenticated', p.oid, 'execute') as ok
         from pg_proc p join pg_namespace n2 on n2.oid=p.pronamespace
        where n2.nspname='public' and p.proname in ('jh_course_taxonomy','jh_my_rank')`,
    );
    expect(r.every((x) => x.ok)).toBe(true);
    expect(r.length).toBe(2);
  });
});
