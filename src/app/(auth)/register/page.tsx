import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "./register-form";
import { listCourses } from "@/lib/queries";

export const metadata: Metadata = {
  title: "রেজিস্ট্রেশন",
  description: "JobHub-এ বিনামূল্যে অ্যাকাউন্ট খুলে বাংলাদেশের যেকোনো প্রতিযোগিতামূলক পরীক্ষার প্রস্তুতি শুরু করুন।",
};

export default async function RegisterPage() {
  const courses = await listCourses();
  return (
    <div>
      <h1 className="text-[1.625rem] font-bold tracking-[-0.03em] text-[var(--text)]">
        আপনার প্রস্তুতি শুরু করুন
      </h1>
      <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
        বিনামূল্যে অ্যাকাউন্ট। কোনো কার্ডের তথ্য লাগবে না।
      </p>
      <Suspense fallback={<div className="jh-skeleton mt-8 h-96 w-full" />}>
        <RegisterForm courses={courses.map((c) => ({ slug: c.slug, title: c.title_bn }))} />
      </Suspense>
    </div>
  );
}
