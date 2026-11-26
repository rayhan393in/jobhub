import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { requireAdminAccess } from "@/lib/permissions";

export const metadata: Metadata = {
  title: { default: "অ্যাডমিন", template: "%s · JobHub Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Single definition of "may enter the admin area" (signed in + not a student).
  // Each page below adds its own `requirePermission(...)` for module access.
  const user = await requireAdminAccess();

  return (
    <AdminShell
      user={{ name: user.name, role: user.role }}
      permissions={ROLE_PERMISSIONS[user.role]}
    >
      {children}
    </AdminShell>
  );
}
