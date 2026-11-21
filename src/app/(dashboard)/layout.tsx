import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCurrentUser, displayName } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const names = displayName(user);

  return (
    <DashboardShell
      user={{
        id: user.id,
        name: names.bn,
        email: user.email,
        role: user.role,
        avatarUrl: user.profile?.avatar_url ?? null,
        targetCourseId: user.profile?.target_course_id ?? null,
      }}
    >
      {children}
    </DashboardShell>
  );
}
