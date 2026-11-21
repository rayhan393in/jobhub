"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";

export function AccountForm({
  profile,
  courses,
}: {
  profile: { full_name: string; full_name_bn: string; phone: string; locale: string; target_course_id: string | null };
  courses: { id: string; title_bn: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = React.useState(profile);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.full_name,
          fullNameBn: form.full_name_bn,
          phone: form.phone,
          locale: form.locale,
          targetCourseId: form.target_course_id,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "সংরক্ষণ করা যায়নি।");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="jh-card p-5" noValidate>
      <h2 className="text-[0.9375rem] font-semibold text-[var(--text)]">প্রোফাইল তথ্য</h2>
      <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="fullName" className="jh-label">পূর্ণ নাম (ইংরেজি)</label>
          <Input
            id="fullName"
            value={form.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            autoComplete="name"
            maxLength={80}
          />
        </div>
        <div>
          <label htmlFor="fullNameBn" className="jh-label">পূর্ণ নাম (বাংলা)</label>
          <Input
            id="fullNameBn"
            value={form.full_name_bn}
            onChange={(e) => update("full_name_bn", e.target.value)}
            className="font-bangla"
            maxLength={80}
          />
        </div>
        <div>
          <label htmlFor="phone" className="jh-label">মোবাইল</label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="01XXXXXXXXX"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
          />
        </div>
        <div>
          <label htmlFor="locale" className="jh-label">ভাষা</label>
          <Select id="locale" value={form.locale} onChange={(e) => update("locale", e.target.value)}>
            <option value="bn">বাংলা</option>
            <option value="en">English</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="targetCourse" className="jh-label">লক্ষ্য কোর্স</label>
          <Select
            id="targetCourse"
            value={form.target_course_id ?? ""}
            onChange={(e) => update("target_course_id", e.target.value || null)}
          >
            <option value="">নির্বাচন করুন</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title_bn}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 flex items-center gap-1.5 text-[0.75rem] font-medium text-[var(--danger)]">
          <TriangleAlert className="size-3.5" aria-hidden />
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" size="sm" loading={saving}>সংরক্ষণ করুন</Button>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-mint-600 dark:text-mint-500">
            <Check className="size-3.5" aria-hidden />
            সংরক্ষিত হয়েছে
          </span>
        ) : null}
      </div>
    </form>
  );
}
