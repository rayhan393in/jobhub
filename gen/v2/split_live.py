#!/usr/bin/env python3
"""Splits the rendered taxonomy migration into live-applyable chunks.

The Supabase SQL connector runs every call in a NEW session, so the repo
migration's `create temp table … on commit drop` working tables (fine under
`migrate.mjs`, which wraps the file in one transaction) would vanish between
calls. This script

  * rewrites the working tables into schema `jh_mig` as real tables,
  * keeps every chunk under the connector's ~24 KB request cap, measured in
    JSON-escaped bytes (Bengali text becomes \\uXXXX — 6 bytes a character),
  * groups `jh_sub_seed` rows by (subject, topic) so the repeated prefix is
    written once per statement instead of once per subtopic,
  * strips the Bengali section headers (the connector pipeline mangles them).

Output: gen/live-chunks/NN.sql in apply order, then 99_cleanup.sql.

Usage: python3 gen/split_live.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "supabase/migrations/20261214000000_bcs_preliminary_taxonomy.sql"
OUT = ROOT / "gen/live-chunks"

WORK_TABLES = [
    "jh_tx", "jh_topic_seed", "jh_sub_seed", "jh_claim", "jh_sub_claim",
    "jh_retired_topic", "jh_retired_sub", "jh_link_map", "jh_link_target",
    "jh_sub_remap", "jh_detail_seed",
]

LIMIT = 19_000  # escaped bytes; the connector rejects a call at ~24 KB


def size_of(text: str) -> int:
    return len(json.dumps(text))


def split_top_level(body: str) -> list[str]:
    """Split on commas outside parentheses and quotes."""
    parts, depth, current, quote = [], 0, "", None
    for ch in body:
        if quote:
            current += ch
            if ch == quote:
                quote = None
            continue
        if ch in "'\"":
            quote = ch
            current += ch
        elif ch == "(":
            depth += 1
            current += ch
        elif ch == ")":
            depth -= 1
            current += ch
        elif ch == "," and depth == 0:
            parts.append(current)
            current = ""
        else:
            current += ch
    if current.strip():
        parts.append(current)
    return [p.strip() for p in parts]


def tuples_of(body: str) -> list[str]:
    """Every top-level `( … )` tuple of a values list."""
    tuples, depth, start = [], 0, None
    for i, ch in enumerate(body):
        if ch == "(":
            if depth == 0:
                start = i
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0 and start is not None:
                tuples.append(body[start : i + 1])
                start = None
    return tuples


def bare(value: str) -> str:
    """`'x'::text` -> `x`; keeps the literal text untouched."""
    value = value.strip()
    value = re.sub(r"::[a-z][a-z0-9_ ]*(\([^)]*\))?$", "", value).strip()
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    return value


def types_of(example: str, count: int) -> list[str]:
    types = []
    for expr in split_top_level(example[1:-1]):
        match = re.search(r"::([a-z][a-z0-9_ ]*(?:\([^)]*\))?)$", expr)
        types.append(match.group(1) if match else "text")
    while len(types) < count:
        types.append("text")
    return types


def seed_statements(sql: str) -> list[str]:
    """Rewrite `create temp table X as select … from (values …) v(…)` into a
    persistent create plus size-bounded inserts."""
    pattern = re.compile(
        r"create temp table (?P<name>jh_\w+) on commit drop as\n"
        r"(?P<select>select [\s\S]*?from \(values\n)"
        r"(?P<body>[\s\S]*?)\n\) as v\((?P<cols>[^)]*)\);",
        re.MULTILINE,
    )
    out, last = [], 0
    for match in pattern.finditer(sql):
        out.append(sql[last : match.start()])
        name = match.group("name")
        select = match.group("select").strip()
        cols = match.group("cols")
        select_cols = [c.strip() for c in select.split("select", 1)[1].split("from", 1)[0].strip().rstrip(",").split(",")]
        rows = tuples_of(match.group("body"))

        if name == "jh_sub_seed":
            out.extend(grouped_sub_seed(rows))
        else:
            types = types_of(rows[0], len(select_cols))
            out.append(
                f"drop table if exists jh_mig.{name};\n"
                f"create table jh_mig.{name} ({', '.join(f'{c.split(chr(46))[-1]} {t}' for c, t in zip(select_cols, types))});"
            )
            chunk, size = [], 0
            for row in rows:
                if size and size + size_of(row) > LIMIT:
                    out.append(insert_block(name, select, cols, chunk))
                    chunk, size = [], 0
                chunk.append(row)
                size += size_of(row) + 2
            if chunk:
                out.append(insert_block(name, select, cols, chunk))
        last = match.end()
    out.append(sql[last:])
    return out


def insert_block(name: str, select: str, cols: str, rows: list[str]) -> str:
    return f"insert into jh_mig.{name}\n{select}\n" + ",\n".join(rows) + f"\n) as v({cols});"


def grouped_sub_seed(rows: list[str]) -> list[str]:
    """jh_sub_seed repeats (subject_slug, topic_slug) on every row."""
    head = (
        "drop table if exists jh_mig.jh_sub_seed;\n"
        "create table jh_mig.jh_sub_seed "
        "(subject_slug text, topic_slug text, slug text, title_en text, sort_order smallint, priority text);\n"
    )
    groups: dict[tuple[str, str], list[str]] = {}
    for row in rows:
        parts = split_top_level(row[1:-1])
        groups.setdefault((bare(parts[0]), bare(parts[1])), []).append(
            "('%s'::text, %s, %s::smallint, '%s'::text)"
            % (bare(parts[2]), parts[3], bare(parts[4]), bare(parts[5]))
        )

    statements = [head]
    buffer = ""
    for (subject, topic), values in groups.items():
        statement = (
            "insert into jh_mig.jh_sub_seed\n"
            f"select '{subject}', '{topic}', v.slug, v.title_en, v.sort_order, v.priority\n"
            "from (values " + ",\n".join(values) + ") as v(slug, title_en, sort_order, priority);\n"
        )
        if buffer and size_of(buffer) + size_of(statement) > LIMIT:
            statements.append(buffer)
            buffer = ""
        buffer += statement
    if buffer:
        statements.append(buffer)
    return statements


def qualify(sql: str) -> str:
    for name in WORK_TABLES:
        sql = re.sub(rf"(?<![\w.]){name}(?![\w])", f"jh_mig.{name}", sql)
    # jh_mig is a real schema, so its working tables are real tables too.
    return re.sub(r"create temp table (jh_mig\.\w+) on commit drop as", r"create table \1 as", sql)


def compact_subject_updates(chunks: list[str]) -> list[str]:
    """Ten identical `update public.subjects … where s.slug = 'x'` statements
    collapse into one with a values list."""
    out = []
    for chunk in chunks:
        matches = list(re.finditer(r"update public\.subjects s[\s\S]*?s\.slug = '(\w+)';", chunk))
        if len(matches) < 2:
            out.append(chunk)
            continue
        rows = []
        for match in matches:
            block = match.group(0)
            rows.append(
                "('%s'::text, '%s'::text, %s::smallint, %s::smallint)"
                % (
                    match.group(1),
                    re.search(r"title_en = '([^']+)'", block).group(1),
                    re.search(r"weight = (\d+)", block).group(1),
                    re.search(r"sort_order = (\d+)", block).group(1),
                )
            )
        compact = (
            "update public.subjects s set\n"
            "title_en = v.title_en, weight = v.weight, sort_order = v.sort_order, is_active = true,\n"
            "metadata = s.metadata || jsonb_build_object('marks', v.weight, 'syllabus', 'bcs-preliminary'),\n"
            "updated_at = now()\n"
            "from public.courses c,\n"
            "     (values " + ",\n           ".join(rows) + ") as v(slug, title_en, weight, sort_order)\n"
            "where c.id = s.course_id and c.slug = 'bcs' and s.slug = v.slug;\n"
        )
        out.append(chunk[: matches[0].start()] + compact + chunk[matches[-1].end() :])
    return out


def main() -> None:
    sql = SRC.read_text(encoding="utf-8")
    head_end = sql.index("-- ── ০ ·")
    pieces = [p for p in re.split(r"(?m)^(?=-- ── )", sql[head_end:]) if p.strip()]

    statements = []
    for piece in pieces:
        statements.extend(seed_statements(piece))

    statements = [qualify(s) for s in statements]
    # ASCII-free comments are dropped: the connector pipeline mangles them.
    statements = [re.sub(r"(?m)^--[^\n]*$", "", s) for s in statements]
    statements = [re.sub(r"\n{3,}", "\n\n", s).strip() + "\n" for s in statements if s.strip()]

    preamble = "create schema if not exists jh_mig;\nrevoke all on schema jh_mig from public;\n"
    statements[0] = preamble + statements[0]
    statements = compact_subject_updates(statements)

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.sql"):
        old.unlink()

    index = 0
    for statement in statements:
        index += 1
        (OUT / f"{index:02d}.sql").write_text(statement, encoding="utf-8")

    (OUT / "99_cleanup.sql").write_text("drop schema if exists jh_mig cascade;\n", encoding="utf-8")
    sizes = sorted(((size_of(p.read_text(encoding="utf-8")), p.name) for p in OUT.glob("*.sql")), reverse=True)
    over = [name for size, name in sizes if size > 21_000]
    print(f"{index} chunks + cleanup; largest {sizes[0][1]} = {sizes[0][0]} escaped bytes")
    if over:
        raise SystemExit(f"over budget: {over}")


if __name__ == "__main__":
    main()
