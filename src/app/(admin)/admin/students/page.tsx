import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { listStudents } from "@/lib/admin-queries";
import { requirePermission, can, ROLE_PERMISSIONS } from "@/lib/permissions";
import { formatDate, formatNumber, relativeFromNow } from "@/lib/format";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";
import { StudentRow } from "./student-row";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "শিক্ষার্থী" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string }>;
}) {
  const staff = await requirePermission("student.manage");
  const params = await searchParams;
  const user = await getCurrentUser();
  const students = await listStudents({ role: params.role, search: params.q, limit: 100 });
  const canChangeRoles = can(staff.role, "role.manage");

  return (
    <div className="mx-auto w-full max-w-6xl">
      <AdminPageHeader
        eyebrow="শিক্ষার্থী"
        title="অ্যাকাউন্ট ও ভূমিকা"
        description="ভূমিকা পরিবর্তন শুধু সুপার অ্যাডমিনের ক্ষমতা; সব পরিবর্তন অডিট লগে যায়। নিজের ভূমিকা নিজে বদলানো যায় না।"
        action={<Badge tone="neutral">{formatNumber(students.length)} দেখানো হচ্ছে</Badge>}
      />

      <form method="get" className="jh-card mb-3 flex flex-wrap items-end gap-2 p-3">
        <label className="block min-w-0 flex-1">
          <span className="jh-label">খুঁজুন</span>
          <input
            name="q"
            defaultValue={params.q}
            placeholder="নাম বা ইমেইল…"
            className="jh-input h-9 py-0 text-[0.8125rem]"
          />
        </label>
        <label className="block">
          <span className="jh-label">ভূমিকা</span>
          <select name="role" defaultValue={params.role ?? ""} className="jh-select h-9">
            <option value="">সব</option>
            <option value="student">শিক্ষার্থী</option>
            <option value="content_editor">কনটেন্ট এডিটর</option>
            <option value="admin">প্রশাসক</option>
            <option value="super_admin">সুপার অ্যাডমিন</option>
          </select>
        </label>
        <button type="submit" className="h-9 rounded-lg bg-[var(--brand)] px-3 text-[0.75rem] font-semibold text-white">
          ফিল্টার
        </button>
      </form>

      <AdminNote>
        সুপার অ্যাডমিন ছাড়া কেউ রোল পরিবর্তন করতে পারে না — UI-তে বাটন দেখানো না হলেও সার্ভারও প্রত্যাখ্যান করে
        (<code className="text-[0.625rem]">role.manage</code>)। শিক্ষার্থীর ব্যক্তিগত ফলাফল বা উত্তর অন্য কেউ দেখতে পায় না।
      </AdminNote>

      <div className="mt-3">
        {students.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="কোনো অ্যাকাউন্ট পাওয়া যায়নি"
            description="ফিল্টার বদলে দেখুন, অথবা শিক্ষার্থী নিবন্ধন করলে এখানে দেখা যাবে।"
          />
        ) : (
          <div className="jh-card overflow-hidden">
            <div className="hidden grid-cols-[minmax(0,1fr)_7rem_8rem_5rem_auto] gap-2 border-b border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)] sm:grid">
              <span>নাম</span>
              <span>ভূমিকা</span>
              <span>শেষ সক্রিয়</span>
              <span>সক্রিয়</span>
              <span className="text-right">কার্যক্রম</span>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {students.map((student) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  canChangeRoles={canChangeRoles}
                  isSelf={student.id === user?.id}
                  permissionsCount={ROLE_PERMISSIONS[student.role_id as keyof typeof ROLE_PERMISSIONS]?.length ?? 0}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-3 text-[0.625rem] text-[var(--text-subtle)]">
        অ্যাকাউন্ট তৈরি: {formatDate(new Date().toISOString())} পর্যন্ত ডেটা দেখানো হচ্ছে ·{sortedLabel(students)}
      </p>
    </div>
  );
}

function sortedLabel(students: { created_at: string }[]) {
  if (students.length === 0) return " কোনো রেকর্ড নেই";
  return ` সর্বশেষ নিবন্ধন ${relativeFromNow(students[0].created_at)}`;
}
