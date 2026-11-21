"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ShieldAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ROLES = [
  { id: "student", label: "শিক্ষার্থী" },
  { id: "content_editor", label: "কনটেন্ট এডিটর" },
  { id: "admin", label: "প্রশাসক" },
  { id: "super_admin", label: "সুপার অ্যাডমিন" },
];

export function StudentRow({
  student,
  canChangeRoles,
  isSelf,
  permissionsCount,
}: {
  student: {
    id: string;
    full_name: string | null;
    full_name_bn: string | null;
    email: string | null;
    role_id: string;
    is_active: boolean;
    created_at: string;
    last_active_at: string;
  };
  canChangeRoles: boolean;
  isSelf: boolean;
  permissionsCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/admin/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: student.id, ...body }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "পরিবর্তন ব্যর্থ।");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid grid-cols-1 gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_5rem_auto] sm:items-center sm:gap-2">
      <div className="min-w-0">
        <p className="truncate text-[0.75rem] font-medium text-[var(--text)]">
          {student.full_name_bn ?? student.full_name ?? "নাম নেই"}
          {isSelf ? <span className="ml-1 text-[0.5625rem] text-[var(--brand)]">(আপনি)</span> : null}
        </p>
        <p className="truncate text-[0.5625rem] text-[var(--text-subtle)]">{student.email ?? "ইমেইল নেই"}</p>
        {error ? (
          <p className="mt-0.5 flex items-center gap-1 text-[0.5625rem] font-medium text-[var(--danger)]">
            <TriangleAlert className="size-2.5" aria-hidden />
            {error}
          </p>
        ) : null}
      </div>

      <div>
        {canChangeRoles && !isSelf ? (
          <select
            value={student.role_id}
            disabled={busy}
            onChange={(event) => patch({ roleId: event.target.value })}
            className="jh-select py-1 text-[0.6875rem]"
            aria-label={`Role for ${student.email ?? student.id}`}
          >
            {ROLES.map((role) => (
              <option key={role.id} value={role.id}>{role.label}</option>
            ))}
          </select>
        ) : (
          <Badge tone={student.role_id === "student" ? "neutral" : "brand"}>
            {ROLES.find((role) => role.id === student.role_id)?.label ?? student.role_id}
          </Badge>
        )}
        <p className="mt-0.5 text-[0.5rem] text-[var(--text-subtle)]">{permissionsCount} অনুমতি</p>
      </div>

      <p className="text-[0.5625rem] text-[var(--text-subtle)]">{daysAgo(student.last_active_at)}</p>

      <div className="flex items-center gap-1">
        <Badge tone={student.is_active ? "success" : "danger"}>{student.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}</Badge>
      </div>

      <div className="flex items-center justify-end gap-1">
        {saved ? <Check className="size-3 text-mint-500" aria-hidden /> : null}
        <button
          type="button"
          onClick={() => patch({ isActive: !student.is_active })}
          disabled={busy || isSelf}
          className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[0.5625rem] font-semibold text-[var(--text-muted)] hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-40"
        >
          {student.is_active ? "নিষ্ক্রিয়" : "সক্রিয়"}
        </button>
        {!canChangeRoles ? <ShieldAlert className="size-3 text-[var(--text-subtle)]" aria-hidden /> : null}
      </div>
    </li>
  );
}

function daysAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} মিনিট আগে`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ঘণ্টা আগে`;
  return `${Math.floor(hours / 24)} দিন আগে`;
}
