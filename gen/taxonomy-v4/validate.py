"""Validation for the V4 taxonomy.

The user's rule was explicit: *"আমি একি topics subtopics দুibar রাখতে চাই না"* —
no topic or subtopic may appear twice. This module is the guard, and the
migration generator refuses to emit SQL if it fails.

Names are compared with the database's own normalisation (see
`jh_title_norm` in 20261214000000_bcs_preliminary_taxonomy.sql) rather than
raw string equality, because "ধ্বনি ও বর্ণ" and "ধ্বনি  ও বর্ণ" are the same
topic to a student and must not both exist.
"""

from __future__ import annotations

import re
import unicodedata

from data import DATA

# Bengali sign/vowel removal, mirroring jh_title_norm(): the DB compares titles
# with matras and hasanta stripped, so validation must use the same lens or a
# "duplicate" would slip through and only surface as a unique-index failure.
_SIGNS = re.compile("[\u0995-\u09b9\u09be-\u09cd\u09d7\u09dc-\u09df\u09e6-\u09ef]")
_VOWELS = re.compile("[\u0995-\u09b9]")
_STRIP = re.compile(r"[\s.,;:।\-–—()/\u200b\u200c\u200d\u200e\u200f\ufeff]")


def title_norm(value: str) -> str:
    """Approximate `public.jh_title_norm` for duplicate detection."""
    text = unicodedata.normalize("NFC", value or "").lower()
    text = _SIGNS.sub(lambda m: m.group(0), text)
    # drop combining marks / matras
    text = "".join(
        ch for ch in text if unicodedata.category(ch) != "Mn" and not ("\u09be" <= ch <= "\u09cd")
    )
    text = text.replace("\u09df", "\u09af").replace("\u09dc", "\u09a1").replace("\u09dd", "\u09a2")
    return _STRIP.sub("", text)


def assert_no_duplicates() -> None:
    """Raise if any topic or subtopic repeats. No repair — a human must decide."""
    problems: list[str] = []

    seen_subjects: set[str] = set()
    for subject_slug, topics in DATA:
        if subject_slug in seen_subjects:
            problems.append(f"subject listed twice: {subject_slug}")
        seen_subjects.add(subject_slug)

        seen_topics: dict[str, str] = {}
        for topic_bn, subtopics in topics:
            key = title_norm(topic_bn)
            if key in seen_topics:
                problems.append(
                    f"[{subject_slug}] duplicate topic: {topic_bn!r} == {seen_topics[key]!r}"
                )
            seen_topics[key] = topic_bn

            if subtopics is None:
                continue

            seen_subs: dict[str, str] = {}
            for subtopic_bn, _priority in subtopics:
                sub_key = title_norm(subtopic_bn)
                if sub_key in seen_subs:
                    problems.append(
                        f"[{subject_slug} / {topic_bn}] duplicate subtopic: "
                        f"{subtopic_bn!r} == {seen_subs[sub_key]!r}"
                    )
                seen_subs[sub_key] = subtopic_bn

    if problems:
        raise SystemExit("V4 taxonomy has duplicates:\n  " + "\n  ".join(problems))


def stats() -> dict[str, int]:
    topics = sum(len(t) for _s, t in DATA)
    subtopics = sum(
        len(subs) for _s, t in DATA for _t, subs in t if subs is not None
    )
    leaves = sum(1 for _s, t in DATA for _t, subs in t if subs is None)
    return {
        "subjects": len(DATA),
        "topics": topics,
        "topics_with_subtopics": topics - leaves,
        "topics_null_subtopics": leaves,
        "subtopics": subtopics,
    }


if __name__ == "__main__":
    assert_no_duplicates()
    for key, value in stats().items():
        print(f"{key:24s} {value}")
