"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Play, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StartExamButton({ scheduleId, label }: { scheduleId: string; label: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "পরীক্ষা শুরু করা যায়নি।");
        return;
      }
      router.push(`/exam/${payload.attempt_id}`);
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button size="md" loading={loading} onClick={start}>
        {!loading ? <Play className="size-3.5" aria-hidden /> : null}
        {label}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-[0.75rem] font-medium text-[var(--danger)]">
          <TriangleAlert className="size-3.5" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
