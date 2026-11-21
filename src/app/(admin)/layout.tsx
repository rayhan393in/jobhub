import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = {
  title: { default: "অ্যাডমিন", template: "%s · JobHub Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role === "student") redirect("/dashboard");

  return (
    <AdminShell
      user={{
        name: user.profile?.full_name_bn || user.profile?.full_name || user.email || "স্টাফ",
        role: user.role,
      }}
      permissions={ROLE_PERMISSIONS[user.role]}
    >
      {children}
    </AdminShell>
  );
}
