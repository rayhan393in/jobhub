"use client";

/**
 * Taxonomy workbench — the admin's control room for the syllabus tree.
 *
 * One course at a time: subjects → topics → subtopics → micro-topics.
 * Supports search, approval-status filtering, inline add/edit, approve/
 * reject (single + bulk), guarded delete, CSV/JSON/Excel bulk import with
 * dry-run preview, CSV export, and mapping common-library topics into the
 * selected course.
 */

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Library,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { parseCsv, parseJson, toLatinDigits } from "@/lib/import/parse";

type Subject = {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  weight: number;
  sort_order: number;
  is_active: boolean;
};
type TopicRow = {
  id: string;
  subject_id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  sort_order: number;
  is_active: boolean;
  approval_status: "pending" | "approved" | "rejected";
  source_url: string | null;
  occurrence_years: number[];
  canonical_id: string | null;
};
type SubtopicRow = {
  id: string;
  topic_id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  sort_order: number;
  is_active: boolean;
  approval_status: "pending" | "approved" | "rejected";
};
type MicroRow = {
  id: string;
  subtopic_id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  sort_order: number;
  is_active: boolean;
  approval_status: "pending" | "approved" | "rejected";
};
type CanonicalRow = {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  subject_group: string | null;
};
type Tree = {
  subjects: Subject[];
  topics: TopicRow[];
  subtopics: SubtopicRow[];
  microTopics: MicroRow[];
  canonicalTopics: CanonicalRow[];
};

type Draft = {
  entity: "subject" | "topic" | "subtopic" | "micro_topic" | "canonical_topic";
  id?: string;
  parentId?: string;
  titleBn: string;
  titleEn: string;
  slug: string;
  sourceUrl: string;
  years: string;
  subjectGroup: string;
};

const EMPTY_DRAFT: Draft = {
  entity: "topic",
  titleBn: "",
  titleEn: "",
  slug: "",
  sourceUrl: "",
  years: "",
  subjectGroup: "",
};

function toSlug(preferred: string, fallback: string): string {
  const base = (preferred || fallback).toLowerCase().trim();
  const latin = base
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (latin.length >= 2) return latin.slice(0, 72);
  let hash = 5381;
  const source = fallback.normalize("NFC").trim();
  for (let i = 0; i < source.length; i += 1) hash = ((hash << 5) + hash + source.charCodeAt(i)) >>> 0;
  return `bn-${hash.toString(36)}`;
}

function parseYears(input: string): number[] {
  return toLatinDigits(input)
    .split(/[,;\s]+/)
    .map((part) => Number.parseInt(part, 10))
    .filter((year) => Number.isInteger(year) && year >= 1971 && year <= 2100)
    .slice(0, 80);
}

function statusBadge(status: "pending" | "approved" | "rejected") {
  if (status === "pending") return <Badge tone="warning">পেন্ডিং</Badge>;
  if (status === "rejected") return <Badge tone="neutral">বাতিল</Badge>;
  return null;
}

export function TaxonomyWorkbench({
  courses,
}: {
  courses: Array<{ id: string; title_bn: string; slug: string }>;
}) {
  const [courseId, setCourseId] = React.useState(courses[0]?.id ?? "");
  const [tree, setTree] = React.useState<Tree | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "pending" | "approved" | "rejected">("all");
  const [expandedSubjects, setExpandedSubjects] = React.useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Set<string>>(new Set()); // "topic:id" | "subtopic:id"

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [showImport, setShowImport] = React.useState(false);
  const [showLibrary, setShowLibrary] = React.useState(false);
  const [importRows, setImportRows] = React.useState<Array<Record<string, string>>>([]);
  const [importName, setImportName] = React.useState("");
  const [importPreview, setImportPreview] = React.useState<{
    createdSubjects: number;
    createdTopics: number;
    createdSubtopics: number;
    skipped: number;
    warnings: string[];
  } | null>(null);
  const [mapTarget, setMapTarget] = React.useState<{ canonical: CanonicalRow; subjectId: string } | null>(null);

  const load = React.useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/taxonomy?courseId=${id}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "লোড করা যায়নি।");
      setTree({
        subjects: payload.subjects ?? [],
        topics: payload.topics ?? [],
        subtopics: payload.subtopics ?? [],
        microTopics: payload.microTopics ?? [],
        canonicalTopics: payload.canonicalTopics ?? [],
      });
      setSelected(new Set());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load(courseId);
  }, [courseId, load]);

  const topicsBySubject = React.useMemo(() => {
    const map = new Map<string, TopicRow[]>();
    for (const topic of tree?.topics ?? []) {
      const list = map.get(topic.subject_id) ?? [];
      list.push(topic);
      map.set(topic.subject_id, list);
    }
    return map;
  }, [tree]);

  const subtopicsByTopic = React.useMemo(() => {
    const map = new Map<string, SubtopicRow[]>();
    for (const sub of tree?.subtopics ?? []) {
      const list = map.get(sub.topic_id) ?? [];
      list.push(sub);
      map.set(sub.topic_id, list);
    }
    return map;
  }, [tree]);

  const microBySubtopic = React.useMemo(() => {
    const map = new Map<string, MicroRow[]>();
    for (const micro of tree?.microTopics ?? []) {
      const list = map.get(micro.subtopic_id) ?? [];
      list.push(micro);
      map.set(micro.subtopic_id, list);
    }
    return map;
  }, [tree]);

  const normalizedQuery = query.trim().normalize("NFC").toLowerCase();

  function topicMatches(topic: TopicRow): boolean {
    if (statusFilter !== "all" && topic.approval_status !== statusFilter) return false;
    if (!normalizedQuery) return true;
    const haystack = `${topic.title_bn} ${topic.title_en} ${topic.slug}`.normalize("NFC").toLowerCase();
    if (haystack.includes(normalizedQuery)) return true;
    return (subtopicsByTopic.get(topic.id) ?? []).some((sub) =>
      `${sub.title_bn} ${sub.title_en}`.normalize("NFC").toLowerCase().includes(normalizedQuery),
    );
  }

  function visibleTopics(subjectId: string): TopicRow[] {
    return (topicsBySubject.get(subjectId) ?? []).filter(topicMatches);
  }

  function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveDraft() {
    if (!draft) return;
    const titleBn = draft.titleBn.trim();
    if (titleBn.length < 2) {
      setError("বাংলা শিরোনাম দিন (কমপক্ষে ২ অক্ষর)।");
      return;
    }
    const slug = draft.slug.trim() || toSlug(draft.titleEn, titleBn);
    const values: Record<string, unknown> = {
      slug,
      titleEn: draft.titleEn.trim() || titleBn,
      titleBn,
    };
    if (draft.entity === "subject") values.courseId = courseId;
    if (draft.entity === "topic") {
      values.subjectId = draft.parentId;
      values.sourceUrl = draft.sourceUrl.trim();
      values.occurrenceYears = parseYears(draft.years);
      if (!draft.id) {
        values.approvalStatus = "approved";
      }
    }
    if (draft.entity === "subtopic") values.topicId = draft.parentId;
    if (draft.entity === "micro_topic") values.subtopicId = draft.parentId;
    if (draft.entity === "canonical_topic") values.subjectGroup = draft.subjectGroup.trim();

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/taxonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: draft.entity, id: draft.id, values }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "সংরক্ষণ করা যায়নি।");
        return;
      }
      setNotice(draft.id ? "পরিবর্তন সংরক্ষিত।" : "নতুন এন্ট্রি যোগ হয়েছে।");
      setDraft(null);
      await load(courseId);
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  async function review(entity: "topic" | "subtopic", ids: string[], action: "approve" | "reject") {
    if (ids.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/taxonomy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, ids, action }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "আপডেট করা যায়নি।");
        return;
      }
      setNotice(action === "approve" ? `${payload.updated}টি অনুমোদিত হয়েছে।` : `${payload.updated}টি বাতিল হয়েছে।`);
      await load(courseId);
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  async function reviewSelected(action: "approve" | "reject") {
    const topicIds = [...selected].filter((key) => key.startsWith("topic:")).map((key) => key.slice(6));
    const subtopicIds = [...selected].filter((key) => key.startsWith("subtopic:")).map((key) => key.slice(9));
    if (topicIds.length > 0) await review("topic", topicIds, action);
    if (subtopicIds.length > 0) await review("subtopic", subtopicIds, action);
    setSelected(new Set());
  }

  async function remove(entity: "subject" | "topic" | "subtopic" | "micro_topic", id: string, label: string) {
    if (!window.confirm(`"${label}" স্থায়ীভাবে মুছে ফেলা হবে। প্রশ্ন/রুটিনে ব্যবহৃত হলে মুছতে দেওয়া হবে না।\n\nমুছবেন?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/taxonomy", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "মুছে ফেলা যায়নি।");
        return;
      }
      setNotice(`"${label}" মুছে ফেলা হয়েছে।`);
      await load(courseId);
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  function readImportFile(file: File) {
    setImportName(file.name);
    setImportPreview(null);
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(reader.result, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          if (!sheet) throw new Error("empty");
          setImportRows(parseCsv(XLSX.utils.sheet_to_csv(sheet, { blankrows: false })));
          setError(null);
        } catch {
          setError("Excel ফাইলটি পড়া যায়নি — CSV হিসেবে সেভ করে চেষ্টা করুন।");
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        setImportRows(lower.endsWith(".json") ? parseJson(text) : parseCsv(text));
        setError(null);
      } catch {
        setError("ফাইলটি পড়া যায়নি — কলাম হেডারসহ CSV/JSON দিন।");
      }
    };
    reader.readAsText(file);
  }

  function pick(row: Record<string, string>, keys: string[]): string {
    for (const key of keys) {
      const value = row[key];
      if (value && value.trim()) return value.trim();
    }
    return "";
  }

  function buildImportPayloadRows() {
    return importRows
      .map((row) => ({
        subject: pick(row, ["subject", "বিষয়", "subject_bn"]),
        subjectEn: pick(row, ["subject_en"]),
        topic: pick(row, ["topic", "টপিক", "topic_bn"]),
        topicEn: pick(row, ["topic_en"]),
        subtopic: pick(row, ["subtopic", "সাব-টপিক", "সাবটপিক", "subtopic_bn"]),
        subtopicEn: pick(row, ["subtopic_en"]),
        sourceUrl: pick(row, ["source_url", "source", "উৎস"]),
        occurrenceYears: parseYears(pick(row, ["occurrence_years", "years", "সাল"])),
      }))
      .filter((row) => row.subject && row.topic);
  }

  async function runImport(dryRun: boolean) {
    const rows = buildImportPayloadRows();
    if (rows.length === 0) {
      setError("কোনো বৈধ সারি নেই — subject ও topic কলাম আবশ্যক।");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/taxonomy/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, dryRun, rows }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "ইমপোর্ট ব্যর্থ।");
        return;
      }
      setImportPreview(payload);
      if (!dryRun) {
        setNotice(
          `ইমপোর্ট সম্পন্ন: ${payload.createdSubjects} বিষয়, ${payload.createdTopics} টপিক, ${payload.createdSubtopics} সাব-টপিক (পেন্ডিং অবস্থায়)।`,
        );
        setImportRows([]);
        setImportName("");
        setImportPreview(null);
        setShowImport(false);
        await load(courseId);
      }
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  async function mapCanonical() {
    if (!mapTarget || !mapTarget.subjectId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/taxonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "topic",
          values: {
            subjectId: mapTarget.subjectId,
            slug: mapTarget.canonical.slug,
            titleEn: mapTarget.canonical.title_en,
            titleBn: mapTarget.canonical.title_bn,
            canonicalId: mapTarget.canonical.id,
            approvalStatus: "approved",
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "ম্যাপ করা যায়নি।");
        return;
      }
      setNotice(`"${mapTarget.canonical.title_bn}" এই কোর্সে ম্যাপ হয়েছে।`);
      setMapTarget(null);
      await load(courseId);
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy(false);
    }
  }

  const pendingSelected = selected.size;

  function draftForm() {
    if (!draft) return null;
    const labels: Record<Draft["entity"], string> = {
      subject: "বিষয়",
      topic: "টপিক",
      subtopic: "সাব-টপিক",
      micro_topic: "মাইক্রো-টপিক",
      canonical_topic: "কমন টপিক",
    };
    return (
      <div className="jh-card border-[var(--brand)]/40 p-3">
        <div className="flex items-start justify-between">
          <h3 className="text-[0.8125rem] font-semibold text-[var(--text)]">
            {draft.id ? `${labels[draft.entity]} সম্পাদনা` : `নতুন ${labels[draft.entity]}`}
          </h3>
          <button
            type="button"
            onClick={() => setDraft(null)}
            className="rounded p-1 text-[var(--text-subtle)]"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="jh-label">বাংলা শিরোনাম *</span>
            <Input
              value={draft.titleBn}
              onChange={(e) => setDraft({ ...draft, titleBn: e.target.value })}
              className="h-8 font-bangla text-[0.8125rem]"
            />
          </label>
          <label className="block">
            <span className="jh-label">English title</span>
            <Input
              value={draft.titleEn}
              onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })}
              className="h-8 text-[0.8125rem]"
            />
          </label>
          {draft.entity === "topic" ? (
            <>
              <label className="block">
                <span className="jh-label">উৎস লিংক (ঐচ্ছিক)</span>
                <Input
                  value={draft.sourceUrl}
                  onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
                  placeholder="https://…"
                  className="h-8 text-[0.75rem]"
                />
              </label>
              <label className="block">
                <span className="jh-label">পূর্ববর্তী বছর (কমা দিয়ে)</span>
                <Input
                  value={draft.years}
                  onChange={(e) => setDraft({ ...draft, years: e.target.value })}
                  placeholder="২০১০, ২০১৬, ২০২৩"
                  className="h-8 font-bangla text-[0.75rem]"
                />
              </label>
            </>
          ) : null}
          {draft.entity === "canonical_topic" ? (
            <label className="block">
              <span className="jh-label">বিষয় গ্রুপ (যেমন: বাংলা)</span>
              <Input
                value={draft.subjectGroup}
                onChange={(e) => setDraft({ ...draft, subjectGroup: e.target.value })}
                className="h-8 font-bangla text-[0.8125rem]"
              />
            </label>
          ) : null}
        </div>
        <div className="mt-2.5 flex gap-2">
          <Button size="sm" onClick={saveDraft} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
            সংরক্ষণ
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDraft(null)} disabled={busy}>
            বাতিল
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="jh-card flex flex-wrap items-center gap-2 p-3">
        <select
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setDraft(null);
            setShowImport(false);
          }}
          className="jh-select max-w-[14rem]"
          aria-label="কোর্স"
        >
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title_bn}
            </option>
          ))}
        </select>

        <div className="relative min-w-[10rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-subtle)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="টপিক / সাব-টপিক খুঁজুন…"
            className="h-9 pl-8 font-bangla text-[0.8125rem]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="jh-select max-w-[9rem]"
          aria-label="স্ট্যাটাস"
        >
          <option value="all">সব স্ট্যাটাস</option>
          <option value="pending">পেন্ডিং</option>
          <option value="approved">অনুমোদিত</option>
          <option value="rejected">বাতিল</option>
        </select>

        <Button size="sm" variant="secondary" onClick={() => setShowLibrary((v) => !v)}>
          <Library className="size-3.5" aria-hidden />
          কমন লাইব্রেরি
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowImport((v) => !v)}>
          <Upload className="size-3.5" aria-hidden />
          বাল্ক ইমপোর্ট
        </Button>
        <a
          href={`/api/admin/taxonomy/bulk?courseId=${courseId}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 text-[0.75rem] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
        >
          <Download className="size-3.5" aria-hidden />
          এক্সপোর্ট (CSV)
        </a>
        <Button
          size="sm"
          onClick={() =>
            setDraft({ ...EMPTY_DRAFT, entity: "subject" })
          }
        >
          <Plus className="size-3.5" aria-hidden />
          নতুন বিষয়
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[0.75rem] text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.75rem] text-emerald-700">
          {notice}
        </p>
      ) : null}

      {/* Bulk selection action bar */}
      {pendingSelected > 0 ? (
        <div className="jh-card flex flex-wrap items-center gap-2 border-amber-300 bg-amber-50/60 p-2.5">
          <span className="text-[0.75rem] font-semibold text-[var(--text)]">{pendingSelected}টি নির্বাচিত</span>
          <Button size="sm" onClick={() => reviewSelected("approve")} disabled={busy}>
            <Check className="size-3.5" aria-hidden /> অনুমোদন
          </Button>
          <Button size="sm" variant="secondary" onClick={() => reviewSelected("reject")} disabled={busy}>
            <X className="size-3.5" aria-hidden /> বাতিল
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())} disabled={busy}>
            নির্বাচন মুছুন
          </Button>
        </div>
      ) : null}

      {/* Bulk import panel */}
      {showImport ? (
        <div className="jh-card p-3">
          <h3 className="text-[0.8125rem] font-semibold text-[var(--text)]">বাল্ক ইমপোর্ট (CSV / JSON / Excel)</h3>
          <p className="mt-1 text-[0.6875rem] text-[var(--text-muted)]">
            কলাম: <code>subject, topic, subtopic, source_url, occurrence_years</code> (বাংলা হেডার “বিষয়, টপিক,
            সাব-টপিক”-ও চলবে)। নতুন টপিক/সাব-টপিক <strong>পেন্ডিং</strong> অবস্থায় ঢুকবে; বিদ্যমান কোনো এন্ট্রি বদলাবে না।
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept=".csv,.json,.txt,.xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readImportFile(file);
              }}
              className="text-[0.75rem]"
            />
            {importName ? (
              <span className="text-[0.6875rem] text-[var(--text-subtle)]">
                {importName} · {importRows.length} সারি
              </span>
            ) : null}
          </div>
          {importRows.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => runImport(true)} disabled={busy}>
                {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                যাচাই (ড্রাই রান)
              </Button>
              {importPreview ? (
                <>
                  <span className="text-[0.75rem] text-[var(--text-muted)]">
                    নতুন: {importPreview.createdSubjects} বিষয়, {importPreview.createdTopics} টপিক,{" "}
                    {importPreview.createdSubtopics} সাব-টপিক · ডুপ্লিকেট বাদ: {importPreview.skipped}
                  </span>
                  <Button size="sm" onClick={() => runImport(false)} disabled={busy}>
                    কমিট করুন
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
          {importPreview && importPreview.warnings.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-[0.6875rem] text-amber-700">
              {importPreview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Canonical library */}
      {showLibrary && tree ? (
        <div className="jh-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[0.8125rem] font-semibold text-[var(--text)]">
              কমন টপিক লাইব্রেরি ({tree.canonicalTopics.length})
            </h3>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDraft({ ...EMPTY_DRAFT, entity: "canonical_topic" })}
            >
              <Plus className="size-3.5" aria-hidden /> নতুন কমন টপিক
            </Button>
          </div>
          <p className="mt-1 text-[0.6875rem] text-[var(--text-muted)]">
            একই টপিক (যেমন: সন্ধি, Tense, শতকরা) একবার তৈরি করে একাধিক কোর্সে ম্যাপ করুন — কোর্সভেদে সাব-টপিক ও
            কঠিনতা আলাদা রাখা যাবে।
          </p>
          {tree.canonicalTopics.length === 0 ? (
            <p className="mt-2 text-[0.75rem] text-[var(--text-subtle)]">লাইব্রেরি খালি।</p>
          ) : (
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {tree.canonicalTopics.map((canonical) => {
                const mappedHere = tree.topics.some((t) => t.canonical_id === canonical.id);
                return (
                  <li
                    key={canonical.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-2.5 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[0.75rem] font-medium text-[var(--text)]">{canonical.title_bn}</p>
                      <p className="truncate text-[0.625rem] text-[var(--text-subtle)]">
                        {canonical.subject_group ?? "সাধারণ"} · {canonical.slug}
                      </p>
                    </div>
                    {mappedHere ? (
                      <Badge tone="success">ম্যাপড</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setMapTarget({ canonical, subjectId: tree.subjects[0]?.id ?? "" })}
                      >
                        ম্যাপ করুন
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {mapTarget ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--surface-muted)] p-2.5">
              <span className="text-[0.75rem] font-semibold">“{mapTarget.canonical.title_bn}” → কোন বিষয়ে?</span>
              <select
                value={mapTarget.subjectId}
                onChange={(e) => setMapTarget({ ...mapTarget, subjectId: e.target.value })}
                className="jh-select max-w-[12rem]"
              >
                {tree.subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.title_bn}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={mapCanonical} disabled={busy || !mapTarget.subjectId}>
                নিশ্চিত করুন
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setMapTarget(null)}>
                বাতিল
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {draftForm()}

      {/* Tree */}
      {loading ? (
        <div className="jh-card flex items-center gap-2 p-4 text-[0.8125rem] text-[var(--text-muted)]">
          <Loader2 className="size-4 animate-spin" aria-hidden /> লোড হচ্ছে…
        </div>
      ) : !tree || tree.subjects.length === 0 ? (
        <div className="jh-card p-4 text-[0.8125rem] text-[var(--text-muted)]">
          এই কোর্সে এখনো কোনো বিষয় নেই — “নতুন বিষয়” বা “বাল্ক ইমপোর্ট” দিয়ে শুরু করুন।
        </div>
      ) : (
        <ul className="space-y-2">
          {tree.subjects.map((subject) => {
            const subjectTopics = visibleTopics(subject.id);
            const allTopics = topicsBySubject.get(subject.id) ?? [];
            const pendingCount = allTopics.filter((t) => t.approval_status === "pending").length;
            const open = expandedSubjects.has(subject.id) || Boolean(normalizedQuery) || statusFilter !== "all";
            if ((normalizedQuery || statusFilter !== "all") && subjectTopics.length === 0) return null;
            return (
              <li key={subject.id} className="jh-card overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggle(setExpandedSubjects, subject.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    aria-expanded={open}
                  >
                    {open ? (
                      <ChevronDown className="size-3.5 shrink-0 text-[var(--text-subtle)]" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0 text-[var(--text-subtle)]" />
                    )}
                    <span className="truncate text-[0.875rem] font-semibold text-[var(--text)]">
                      {subject.title_bn}
                    </span>
                    <span className="shrink-0 text-[0.625rem] text-[var(--text-subtle)]">
                      {allTopics.length} টপিক
                    </span>
                    {pendingCount > 0 ? <Badge tone="warning">{pendingCount} পেন্ডিং</Badge> : null}
                    {!subject.is_active ? <Badge tone="neutral">নিষ্ক্রিয়</Badge> : null}
                  </button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setDraft({ ...EMPTY_DRAFT, entity: "topic", parentId: subject.id })
                    }
                  >
                    <Plus className="size-3" aria-hidden /> টপিক
                  </Button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        entity: "subject",
                        id: subject.id,
                        titleBn: subject.title_bn,
                        titleEn: subject.title_en,
                        slug: subject.slug,
                        sourceUrl: "",
                        years: "",
                        subjectGroup: "",
                      })
                    }
                    className="rounded p-1 text-[var(--text-subtle)] hover:text-[var(--text)]"
                    aria-label={`Edit ${subject.title_bn}`}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove("subject", subject.id, subject.title_bn)}
                    className="rounded p-1 text-[var(--text-subtle)] hover:text-red-600"
                    aria-label={`Delete ${subject.title_bn}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {open ? (
                  <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                    {subjectTopics.length === 0 ? (
                      <li className="px-4 py-2 text-[0.75rem] text-[var(--text-subtle)]">কোনো টপিক নেই।</li>
                    ) : (
                      subjectTopics.map((topic) => {
                        const children = subtopicsByTopic.get(topic.id) ?? [];
                        const topicOpen = expandedTopics.has(topic.id);
                        return (
                          <li key={topic.id} className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              {topic.approval_status === "pending" ? (
                                <input
                                  type="checkbox"
                                  checked={selected.has(`topic:${topic.id}`)}
                                  onChange={() => toggle(setSelected, `topic:${topic.id}`)}
                                  className="size-3.5 accent-[var(--brand)]"
                                  aria-label={`Select ${topic.title_bn}`}
                                />
                              ) : (
                                <span className="w-3.5" />
                              )}
                              <button
                                type="button"
                                onClick={() => toggle(setExpandedTopics, topic.id)}
                                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                              >
                                {children.length > 0 ? (
                                  topicOpen ? (
                                    <ChevronDown className="size-3 shrink-0 text-[var(--text-subtle)]" />
                                  ) : (
                                    <ChevronRight className="size-3 shrink-0 text-[var(--text-subtle)]" />
                                  )
                                ) : (
                                  <span className="w-3" />
                                )}
                                <span className="truncate text-[0.8125rem] text-[var(--text)]">{topic.title_bn}</span>
                                {statusBadge(topic.approval_status)}
                                {topic.canonical_id ? <Badge tone="brand">কমন</Badge> : null}
                                {topic.occurrence_years.length > 0 ? (
                                  <span className="shrink-0 text-[0.625rem] text-[var(--text-subtle)]">
                                    {topic.occurrence_years.length} বার এসেছে
                                  </span>
                                ) : null}
                                {children.length > 0 ? (
                                  <span className="shrink-0 text-[0.625rem] text-[var(--text-subtle)]">
                                    · {children.length} সাব-টপিক
                                  </span>
                                ) : null}
                              </button>
                              {topic.source_url ? (
                                <a
                                  href={topic.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="shrink-0 text-[0.625rem] text-[var(--brand)] underline"
                                >
                                  উৎস
                                </a>
                              ) : null}
                              {topic.approval_status === "pending" ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => review("topic", [topic.id], "approve")}
                                    className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                                    aria-label="Approve"
                                    disabled={busy}
                                  >
                                    <Check className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => review("topic", [topic.id], "reject")}
                                    className="rounded p-1 text-[var(--text-subtle)] hover:bg-red-50 hover:text-red-600"
                                    aria-label="Reject"
                                    disabled={busy}
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </>
                              ) : null}
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft({
                                    ...EMPTY_DRAFT,
                                    entity: "subtopic",
                                    parentId: topic.id,
                                  })
                                }
                                className="rounded p-1 text-[var(--text-subtle)] hover:text-[var(--text)]"
                                aria-label={`Add subtopic under ${topic.title_bn}`}
                              >
                                <Plus className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft({
                                    entity: "topic",
                                    id: topic.id,
                                    parentId: topic.subject_id,
                                    titleBn: topic.title_bn,
                                    titleEn: topic.title_en,
                                    slug: topic.slug,
                                    sourceUrl: topic.source_url ?? "",
                                    years: topic.occurrence_years.join(", "),
                                    subjectGroup: "",
                                  })
                                }
                                className="rounded p-1 text-[var(--text-subtle)] hover:text-[var(--text)]"
                                aria-label={`Edit ${topic.title_bn}`}
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => remove("topic", topic.id, topic.title_bn)}
                                className="rounded p-1 text-[var(--text-subtle)] hover:text-red-600"
                                aria-label={`Delete ${topic.title_bn}`}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>

                            {topicOpen && children.length > 0 ? (
                              <ul className="mt-1 space-y-0.5 pl-10">
                                {children
                                  .filter((sub) => statusFilter === "all" || sub.approval_status === statusFilter)
                                  .map((sub) => {
                                    const micros = microBySubtopic.get(sub.id) ?? [];
                                    return (
                                      <li key={sub.id}>
                                        <div className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-[var(--surface-muted)]">
                                          {sub.approval_status === "pending" ? (
                                            <input
                                              type="checkbox"
                                              checked={selected.has(`subtopic:${sub.id}`)}
                                              onChange={() => toggle(setSelected, `subtopic:${sub.id}`)}
                                              className="size-3 accent-[var(--brand)]"
                                              aria-label={`Select ${sub.title_bn}`}
                                            />
                                          ) : (
                                            <span className="w-3" />
                                          )}
                                          <span className="min-w-0 flex-1 truncate text-[0.75rem] text-[var(--text-muted)]">
                                            {sub.title_bn}
                                          </span>
                                          {statusBadge(sub.approval_status)}
                                          {sub.approval_status === "pending" ? (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => review("subtopic", [sub.id], "approve")}
                                                className="rounded p-0.5 text-emerald-600"
                                                aria-label="Approve"
                                                disabled={busy}
                                              >
                                                <Check className="size-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => review("subtopic", [sub.id], "reject")}
                                                className="rounded p-0.5 text-[var(--text-subtle)] hover:text-red-600"
                                                aria-label="Reject"
                                                disabled={busy}
                                              >
                                                <X className="size-3" />
                                              </button>
                                            </>
                                          ) : null}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setDraft({
                                                ...EMPTY_DRAFT,
                                                entity: "micro_topic",
                                                parentId: sub.id,
                                              })
                                            }
                                            className="rounded p-0.5 text-[var(--text-subtle)] hover:text-[var(--text)]"
                                            aria-label={`Add micro topic under ${sub.title_bn}`}
                                          >
                                            <Plus className="size-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setDraft({
                                                entity: "subtopic",
                                                id: sub.id,
                                                parentId: sub.topic_id,
                                                titleBn: sub.title_bn,
                                                titleEn: sub.title_en,
                                                slug: sub.slug,
                                                sourceUrl: "",
                                                years: "",
                                                subjectGroup: "",
                                              })
                                            }
                                            className="rounded p-0.5 text-[var(--text-subtle)] hover:text-[var(--text)]"
                                            aria-label={`Edit ${sub.title_bn}`}
                                          >
                                            <Pencil className="size-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => remove("subtopic", sub.id, sub.title_bn)}
                                            className="rounded p-0.5 text-[var(--text-subtle)] hover:text-red-600"
                                            aria-label={`Delete ${sub.title_bn}`}
                                          >
                                            <Trash2 className="size-3" />
                                          </button>
                                        </div>
                                        {micros.length > 0 ? (
                                          <ul className="pl-7">
                                            {micros.map((micro) => (
                                              <li
                                                key={micro.id}
                                                className="flex items-center gap-2 px-1.5 py-0.5 text-[0.6875rem] text-[var(--text-subtle)]"
                                              >
                                                <span className="size-1 rounded-full bg-[var(--text-subtle)]" />
                                                <span className="min-w-0 flex-1 truncate">{micro.title_bn}</span>
                                                {statusBadge(micro.approval_status)}
                                                <button
                                                  type="button"
                                                  onClick={() => remove("micro_topic", micro.id, micro.title_bn)}
                                                  className="rounded p-0.5 hover:text-red-600"
                                                  aria-label={`Delete ${micro.title_bn}`}
                                                >
                                                  <Trash2 className="size-3" />
                                                </button>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : null}
                                      </li>
                                    );
                                  })}
                              </ul>
                            ) : null}
                          </li>
                        );
                      })
                    )}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
