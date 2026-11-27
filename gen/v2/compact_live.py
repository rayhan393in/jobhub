#!/usr/bin/env python3
"""Compact live-apply payloads for the taxonomy seeds.

`split_live.py` emits faithful SQL; this one squeezes the big seed tables into
`string_to_array` form so a whole subject fits in one connector call:

    insert into jh_mig.jh_sub_seed
    select v[1], v[2], v[3], v[4], v[5]::smallint, v[6]
    from (select string_to_array(x, '|') as v
            from unnest(string_to_array($payload, E'\n')) as x) s;

Uses the data from gen/data.py directly, so it stays in sync with the renderer.

Usage: python3 gen/compact_live.py  ->  gen/live-compact/NN.sql
"""
import json

from data import DATA, TOPIC_EN
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "gen/live-compact"
LIMIT = 19_000


def ascii_slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def size_of(text: str) -> int:
    return len(json.dumps(text))


def payload_insert(table: str, columns: str, select_expr: str, rows: list[list[str]]) -> list[str]:
    head = (
        f"insert into jh_mig.{table} ({columns})\n"
        f"select {select_expr}\n"
        "from (select string_to_array(x, '|') as v\n"
        "        from unnest(string_to_array(%s, E'\\n')) as x) s;\n"
    )
    out, chunk = [], []
    for row in rows:
        assert not any("|" in value or "\n" in value for value in row), row
        chunk.append(row)
    # split on the escaped budget
    pieces, current, size = [], [], 0
    for row in chunk:
        line = "|".join(row)
        if size and size + size_of(line) > LIMIT:
            pieces.append(current)
            current, size = [], 0
        current.append(line)
        size += size_of(line) + 2
    if current:
        pieces.append(current)
    for piece in pieces:
        body = "\n".join(piece)
        out.append(head % ("$p$" + body + "$p$"))
    return out


def main() -> None:
    topic_rows = []
    sub_rows = []
    for subject, _marks, topics in DATA:
        for index, (title, subs) in enumerate(topics, start=1):
            slug = ascii_slug(TOPIC_EN[title])
            topic_rows.append([subject, slug, TOPIC_EN[title], title, str(index), ""])
            for order, (name, priority) in enumerate(subs, start=1):
                sub_rows.append([subject, slug, f"sub-{order}", name, str(order), priority])

    statements = [
        "create schema if not exists jh_mig;\nrevoke all on schema jh_mig from public;\n",
        "drop table if exists jh_mig.jh_topic_seed;\n"
        "create table jh_mig.jh_topic_seed (subject_slug text, slug text, title_en text, "
        "title_bn text, sort_order smallint, metadata jsonb);\n",
    ]
    statements += payload_insert(
        "jh_topic_seed",
        "subject_slug, slug, title_en, title_bn, sort_order, metadata",
        "v[1], v[2], v[3], v[4], v[5]::smallint, jsonb_build_object('syllabus', 'bcs-preliminary')",
        topic_rows,
    )
    statements.append(
        "drop table if exists jh_mig.jh_sub_seed;\n"
        "create table jh_mig.jh_sub_seed (subject_slug text, topic_slug text, slug text, "
        "title_en text, sort_order smallint, priority text);\n"
    )
    statements += payload_insert(
        "jh_sub_seed",
        "subject_slug, topic_slug, slug, title_en, sort_order, priority",
        "v[1], v[2], v[3], v[4], v[5]::smallint, v[6]",
        sub_rows,
    )

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.sql"):
        old.unlink()
    for index, statement in enumerate(statements, start=1):
        assert size_of(statement) < 22_000, size_of(statement)
        (OUT / f"{index:02d}.sql").write_text(statement, encoding="utf-8")
    print(f"{len(statements)} files, largest {max(size_of(s) for s in statements)} escaped bytes")


if __name__ == "__main__":
    main()
