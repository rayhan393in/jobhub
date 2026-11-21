import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

export type SeedUser = {
  id: string;
  email: string;
  role?: string;
  full_name?: string;
};

/**
 * Boots an in-process PostgreSQL (PGlite) with a Supabase-compatible `auth`
 * schema so the real migrations can be executed and asserted against.
 */
export async function createDatabase() {
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });

  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create schema if not exists auth;

    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      raw_user_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );

    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    create or replace function auth.role() returns text
    language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
    $$;

    grant usage on schema auth to anon, authenticated, service_role;
    grant select, insert, update on auth.users to authenticated, service_role;
  `);

  return db;
}

export async function migrate(db: PGlite, files?: string[]) {
  await db.exec(`reset role;`);
  const list =
    files ??
    readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  for (const file of list) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migration failed: ${file}\n${(error as Error).message}`);
    }
  }
  return list;
}

/** Switch the session to a given user + role, mirroring a Supabase JWT. */
export async function actAs(db: PGlite, userId: string | null, role: "authenticated" | "anon" = "authenticated") {
  await db.exec(`reset role;`);
  if (userId) {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
  } else {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
  await db.query(`select set_config('request.jwt.claim.role', $1, false)`, [role]);
  await db.exec(`set role ${role};`);
}

/** Act as the service role (bypasses RLS) — used by server route handlers. */
export async function actAsService(db: PGlite) {
  await db.exec(`reset role;`);
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.query(`select set_config('request.jwt.claim.role', 'service_role', false)`);
  await db.exec(`set role service_role;`);
}

export async function createUser(db: PGlite, user: SeedUser) {
  await actAsService(db);
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3)`, [
    user.id,
    user.email,
    JSON.stringify({ full_name: user.full_name ?? "Test Student" }),
  ]);
  if (user.role && user.role !== "student") {
    await db.query(`update public.profiles set role_id = $2 where id = $1`, [user.id, user.role]);
  }
  return user;
}

/** Seeds a user with a privileged role as the database owner (bypasses the JWT guard). */
export async function createPrivilegedUser(db: PGlite, user: SeedUser & { role: string }) {
  await createUser(db, user);
  await db.exec(`reset role;`);
  await db.query(`update public.profiles set role_id = $2 where id = $1`, [user.id, user.role]);
  return user;
}

export async function rows<T = Record<string, unknown>>(
  db: PGlite,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await db.query<T>(sql, params as never[]);
  return result.rows as T[];
}

export async function scalar<T = unknown>(db: PGlite, sql: string, params: unknown[] = []): Promise<T> {
  const r = await rows<T>(db, sql, params);
  return r[0] ? (Object.values(r[0] as Record<string, unknown>)[0] as T) : (undefined as T);
}

export async function expectError(promise: Promise<unknown>, pattern?: RegExp) {
  try {
    await promise;
  } catch (error) {
    const message = (error as Error).message;
    if (pattern && !pattern.test(message)) {
      throw new Error(`Expected error matching ${pattern}, got: ${message}`);
    }
    return message;
  }
  throw new Error("Expected an error but the call succeeded");
}

export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}
