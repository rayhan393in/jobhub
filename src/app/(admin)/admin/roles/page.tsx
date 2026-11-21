import type { Metadata } from "next";
import { Fragment } from "react";
import { Lock, ShieldCheck, UserCog } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";
import { requirePermission, ROLE_PERMISSIONS } from "@/lib/permissions";
import { formatNumber } from "@/lib/format";
import { AdminNote, AdminPageHeader } from "@/components/admin/admin-ui";
import { ROLE_LABELS, type RoleId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "রোল ও অনুমতি" };

const ROLE_ORDER: RoleId[] = ["student", "content_editor", "admin", "super_admin"];

export default async function RolesPage() {
  await requirePermission("role.manage");
  const supabase = await getServerClient();

  let permissions: { key: string; label_bn: string; category: string }[] = [];
  let rolePermissions: { role_id: string; permission_key: string }[] = [];
  const counts: Record<string, number> = {};

  if (supabase) {
    const [{ data: permissionRows }, { data: mappings }] = await Promise.all([
      supabase.from("permissions").select("key, label_bn, category").order("category"),
      supabase.from("role_permissions").select("role_id, permission_key"),
    ]);
    permissions = permissionRows ?? [];
    rolePermissions = mappings ?? [];
    for (const role of ROLE_ORDER) {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role_id", role);
      counts[role] = count ?? 0;
    }
  }

  const categories = [...new Set(permissions.map((permission) => permission.category))];
  const grant = (role: RoleId, key: string) =>
    rolePermissions.some((row) => row.role_id === role && row.permission_key === key);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <AdminPageHeader
        eyebrow="রোল ও অনুমতি"
        title="অনুমতি ম্যাট্রিক্স"
        description="ডেটাবেসের role_permissions টেবিলই এখানে দৃশ্যমান। কোনো পরিবর্তন শুধু মাইগ্রেশন বা সুপার অ্যাডমিন সিদ্ধান্তে হয় — UI থেকে সরাসরি নয়।"
        action={<UserCog className="size-5 text-[var(--brand)]" aria-hidden />}
      />

      <AdminNote tone="warning">
        <strong>নিরাপত্তা:</strong> শিক্ষার্থী কখনোই প্রশ্ন অনুমোদন, পরীক্ষা প্রকাশ, রোল পরিবর্তন বা
        অন্য শিক্ষার্থীর ব্যক্তিগত ডেটা দেখতে পারে না — এই নিয়ম RLS ও security-definer ফাংশনে প্রয়োগ করা, শুধু
        UI-তে লুকানো নয়।
      </AdminNote>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ROLE_ORDER.map((role) => (
          <div key={role} className="jh-card p-3">
            <p className="flex items-center gap-1 text-[0.5625rem] uppercase tracking-[0.08em] text-[var(--text-subtle)]">
              <ShieldCheck className="size-3" aria-hidden />
              {role}
            </p>
            <p className="mt-0.5 text-[0.875rem] font-semibold text-[var(--text)]">{ROLE_LABELS[role].bn}</p>
            <p className="text-[0.625rem] text-[var(--text-subtle)]">
              {formatNumber(counts[role] ?? 0)} অ্যাকাউন্ট · {formatNumber(ROLE_PERMISSIONS[role].length)} অনুমতি
            </p>
          </div>
        ))}
      </div>

      <div className="jh-card mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-[0.6875rem]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
              <th scope="col" className="px-3 py-2 font-semibold text-[var(--text-subtle)]">অনুমতি</th>
              {ROLE_ORDER.map((role) => (
                <th key={role} scope="col" className="px-2 py-2 text-center font-semibold text-[var(--text-subtle)]">
                  {ROLE_LABELS[role].bn}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <Fragment key={category}>
                <tr className="bg-[var(--surface)]">
                  <th colSpan={5} scope="colgroup" className="px-3 py-1 text-left text-[0.5625rem] uppercase tracking-[0.1em] text-[var(--brand)]">
                    {category}
                  </th>
                </tr>
                {permissions
                  .filter((permission) => permission.category === category)
                  .map((permission) => (
                    <tr key={permission.key} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-1.5">
                        <p className="font-medium text-[var(--text)]">{permission.label_bn}</p>
                        <code className="text-[0.5rem] text-[var(--text-subtle)]">{permission.key}</code>
                      </td>
                      {ROLE_ORDER.map((role) => (
                        <td key={role} className="px-2 py-1.5 text-center">
                          {grant(role, permission.key) ? (
                            <span className="text-mint-600 dark:text-mint-500" aria-label="granted">✓</span>
                          ) : (
                            <span className="text-[var(--border-strong)]" aria-label="not granted">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[0.625rem] text-[var(--text-subtle)]">
        <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
        এই ম্যাট্রিক্স <code>/admin/roles</code> শুধু পড়ার জন্য। পরিবর্তন করতে SQL মাইগ্রেশন প্রয়োজন — যাতে কোনো
        অনুমতি ভুলবশত সরাসরি UI থেকে দেওয়া না যায়। প্রতিটি টেবিলে সার্ভার-সাইড চেকও আছে।
      </p>
    </div>
  );
}
