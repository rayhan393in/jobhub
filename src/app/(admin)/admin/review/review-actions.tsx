"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CircleSlash, RotateCcw, Send, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

const ACTIONS = [
  { action: "approve", label: "অনুমোদন", icon: Check, variant: "primary" as const },
  { action: "reject", label: "বাতিল", icon: CircleSlash, variant: "secondary" as const },
  { action: "restore", label: "ফিরিয়ে আনুন", icon: RotateCcw, variant: "ghost" as const },
] as const;

export function ReviewActions({ questionId, status }: { questionId: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [showNotes, setShowNotes] = React.useState(false);

  async function run(action: string) {
    setPending(action);
    setError(null);
    try {
      const response = await fetch("/api/admin/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: questionId, action, notes: notes || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "কার্যক্রম ব্যর্থ হয়েছে।");
        return;
      }
      router.refresh();
    } catch {
      setError("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setPending(null);
    }
  }

  const available = ACTIONS.filter((item) => {
    if (action2Status(item.action) === status) return false;
    if (item.action === "restore") return status === "rejected" || status === "archived";
    return status !== "approved";
  });

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {available.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.action}
              size="sm"
              variant={item.variant}
              loading={pending === item.action}
              onClick={() => run(item.action)}
            >
              {pending !== item.action ? <Icon className="size-3" aria-hidden /> : null}
              {item.label}
            </Button>
          );
        })}
        {status !== "approved" ? (
          <Button size="sm" variant="ghost" onClick={() => setShowNotes((v) => !v)}>
            <Send className="size-3" aria-hidden />
            রিভিউ নোট
          </Button>
        ) : null}
      </div>
      {showNotes ? (
        <div className="mt-2">
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="রিভিউ নোট (ঐচ্ছিক) — audit log-এ সংরক্ষিত হবে"
            className="h-8 text-[0.75rem]"
            maxLength={500}
            aria-label="Review notes"
          />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1.5 flex items-center gap-1 text-[0.6875rem] font-medium text-[var(--danger)]">
          <TriangleAlert className="size-3" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function action2Status(action: string) {
  if (action === "approve") return "approved";
  if (action === "reject") return "rejected";
  return "pending_review";
}
