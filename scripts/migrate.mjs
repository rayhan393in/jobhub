#!/usr/bin/env node
/**
 * Applies supabase/migrations/*.sql to a live database, in filename order,
 * exactly once each.
 *
 * Lives here (not in a hosted SQL editor) so the schema is versioned with the
 * code and can be replayed against any empty database — local, staging or
 * production — with one command:
 *
 *   SUPABASE_DB_URL=postgres://... npm run db:migrate
 *
 * Connection details are read from the environment; nothing is hard-coded.
 * Set SUPABASE_DB_URL to the Supavisor pooler string from the Supabase
 * dashboard (Project Settings -> Database -> Connection pooling), e.g.
 *   postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "supabase", "migrations");

const connectionString = process.env.SUPABASE_DB_URL;
const checkOnly = process.argv.includes("--check");
const skip = process.argv.includes("--skip");
const verbose = process.argv.includes("--verbose");
const allowDrift = process.argv.includes("--allow-drift");
let driftDetected = false;


/**
 * Supabase's pooler hostname shards by project age (`aws-0-<region>`,
 * `aws-1-<region>`, ...). Rather than making every operator hunt for the right
 * one, try each shard that resolves until the tenant is recognised.
 */
async function resolvePooler(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return raw; // not a URL we understand — let pg report it
  }
  if (!parsed.hostname.includes(".pooler.supabase.com")) return raw;

  const match = /^(aws-\d+)-(.*)\.pooler\.supabase\.com$/.exec(parsed.hostname);
  if (!match) return raw;
  const [, , region] = match;

  for (let shard = 0; shard <= 3; shard += 1) {
    const hostname = `aws-${shard}-${region}.pooler.supabase.com`;
    const candidate = new URL(raw);
    candidate.hostname = hostname;
    const client = new (await import("pg")).default.Client({
      connectionString: candidate.toString(),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8_000,
    });
    try {
      await client.connect();
      await client.end();
      if (hostname !== parsed.hostname) log(`using pooler shard ${hostname}`);
      return candidate.toString();
    } catch (error) {
      try {
        await client.end();
      } catch {
        /* already closed */
      }
      const transient = /ENOTFOUND|tenant|not found|could not translate/i.test(error.message);
      if (!transient) return raw; // auth/other error: the real attempt will explain it
    }
  }
  return raw;
}

function log(...args) {
  console.log("[migrate]", ...args);
}

async function main() {
  // .env.local is convenient locally; in CI/hosting the variable is already set.
  if (!connectionString) {
    try {
      const envFile = await readFile(join(here, "..", ".env.local"), "utf8");
      for (const line of envFile.split("\n")) {
        const match = /^\s*SUPABASE_DB_URL\s*=\s*(.+)\s*$/.exec(line);
        if (match) process.env.SUPABASE_DB_URL = match[1].replace(/^["']|["']$/g, "");
      }
    } catch {
      /* no .env.local — fine */
    }
  }

  const url = process.env.SUPABASE_DB_URL;
  if (!url && skip) {
    log("no SUPABASE_DB_URL — skipping (set it to apply migrations)");
    return;
  }
  if (!url) {
    console.error(
      [
        "",
        "[migrate] SUPABASE_DB_URL is not set.",
        "",
        "  SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres' \\",
        "    npm run db:migrate",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  const { default: pg } = await import("pg");
  const resolved = await resolvePooler(process.env.SUPABASE_DB_URL);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  if (files.length === 0) {
    log("no migration files found");
    return;
  }

  // A direct connection keeps a single transaction/DDL session window, which DDL
  // needs; the pooler's session mode works the same way.
  const client = new pg.Client({
    connectionString: resolved,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
    statement_timeout: 120_000,
    application_name: "jobhub-migrate",
  });

  await client.connect();
  log("connected");

  await client.query(`
    create table if not exists public.schema_migrations (
      filename    text primary key,
      checksum    text not null,
      applied_at  timestamptz not null default now()
    );
  `);

  const { rows } = await client.query("select filename, checksum from public.schema_migrations");
  const applied = new Map(rows.map((r) => [r.filename, r.checksum]));

  let ran = 0;
  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), "utf8");
    const checksum = (await import("node:crypto"))
      .createHash("sha256")
      .update(sql)
      .digest("hex")
      .slice(0, 32);

    if (applied.has(file)) {
      if (applied.get(file) !== checksum) {
        // The file's bytes differ from what was recorded, so re-running it is
        // NOT guaranteed to be a no-op — that is the whole point of tracking a
        // checksum. Refuse to guess in production; `--allow-drift` re-applies
        // for the local case where a migration was edited before being shared.
        const drift = `edited after it was applied: ${file}`;
        if (allowDrift) {
          log(`WARNING ${drift} — re-applying because --allow-drift was passed`);
        } else if (checkOnly) {
          log(`DRIFT ${drift}`);
          driftDetected = true;
          continue;
        } else {
          console.error(`[migrate] ${drift}`);
          console.error(
            "[migrate] Refusing to continue. Every migration must be immutable once applied.\n" +
              "[migrate] Add a new migration that makes the change, or pass --allow-drift to force a re-run.",
          );
          await client.end();
          process.exit(1);
        }
      } else {
        log(`skip ${file}`);
        continue;
      }
    }

    if (checkOnly) {
      log(`would apply ${file}`);
      continue;
    }

    const started = Date.now();
    log(`apply ${file} (${(sql.length / 1024).toFixed(1)} KB)`);
    try {
      // Each file is a single transaction: a failure leaves the database
      // exactly as it was before this file.
      await client.query("begin");
      await client.query(sql);
      await client.query(
        `insert into public.schema_migrations (filename, checksum) values ($1, $2)
         on conflict (filename) do update set checksum = excluded.checksum, applied_at = now()`,
        [file, checksum],
      );
      await client.query("commit");
      ran += 1;
      log(`done ${file} in ${Date.now() - started}ms`);
    } catch (error) {
      await client.query("rollback").catch(() => {});
      console.error(`[migrate] FAILED ${file}\n${error.message}`);
      if (verbose && error.position) {
        const position = Number(error.position);
        console.error(`[migrate] near: ${sql.slice(Math.max(0, position - 200), position + 200)}`);
      }
      await client.end();
      process.exit(1);
    }
  }

  const counts = await client.query(`
    select
      (select count(*) from public.courses)   as courses,
      (select count(*) from public.subjects)  as subjects,
      (select count(*) from public.topics)    as topics,
      (select count(*) from public.questions) as questions,
      (select count(*) from public.profiles)  as profiles`);
  log(`applied ${ran} of ${files.length} migrations`);
  log("counts", JSON.stringify(counts.rows[0]));

  await client.end();

  if (driftDetected) {
    console.error("[migrate] one or more migrations were edited after being applied");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[migrate] fatal:", error.message);
  process.exit(1);
});
