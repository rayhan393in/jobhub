import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { listCourses } from "@/lib/queries";
import { ROLE_LABELS } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { AccountForm } from "./account-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "অ্যাকাউন্ট" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const courses = await listCourses();
  const profile = user.profile;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        eyebrow="অ্যাকাউন্ট"
        title="আপনার তথ্য"
        description="এই তথ্য শুধু আপনার নিজের প্রোফাইলে দৃশ্যমান। ভূমিকা (role) পরিবর্তন করা কেবল প্রশাসকের ক্ষমতা — এখান থেকে নয়।"
      />

      <div className="jh-card mb-4 flex flex-wrap items-center gap-3 p-4">
        <span className="flex size-10 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[0.875rem] font-bold text-[var(--brand)]">
          {(profile?.full_name_bn || profile?.full_name || user.email || "শ").charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.875rem] font-semibold text-[var(--text)]">
            {profile?.full_name_bn || profile?.full_name || "নাম নেই"}
          </p>
          <p className="truncate text-[0.6875rem] text-[var(--text-subtle)]">{user.email}</p>
        </div>
        <Badge tone="brand">{ROLE_LABELS[user.role].bn}</Badge>
        <p className="w-full text-[0.625rem] text-[var(--text-subtle)] sm:w-auto">
          যোগদান: {formatDate(profile?.created_at ?? new Date().toISOString())}
        </p>
      </div>

      <AccountForm
        profile={{
          full_name: profile?.full_name ?? "",
          full_name_bn: profile?.full_name_bn ?? "",
          phone: profile?.phone ?? "",
          locale: profile?.locale ?? "bn",
          target_course_id: profile?.target_course_id ?? null,
        }}
        courses={courses.map((c) => ({ id: c.id, title_bn: c.title_bn }))}
      />

      <div className="jh-card mt-4 p-4">
        <h2 className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
          <ShieldCheck className="size-4 text-[var(--brand)]" aria-hidden />
          নিরাপত্তা ও গোপনীয়তা
        </h2>
        <ul className="mt-2 space-y-1 text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
          <li>পাসওয়ার্ড পরিবর্তন লিংক ইমেইলে পাঠানো হয় — অ্যাপে পাসওয়ার্ড কখনো সংরক্ষণ করা হয় না।</li>
          <li>আপনার উত্তর, ফলাফল ও বুকমার্ক RLS-এর মাধ্যমে সুরক্ষিত; অন্য কোনো শিক্ষার্থী তা দেখতে পারে না।</li>
          <li>কোনো প্রশ্নে সমস্যা মনে হলে যোগাযোগ পাতা থেকে জানান।</li>
        </ul>
      </div>
    </div>
  );
}
