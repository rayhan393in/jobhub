import { BookOpenCheck, CircleCheck, Target, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/ui/stat";
import { formatNumber } from "@/lib/format";
import type { StudentAnalytics } from "@/lib/types";

/** The four headline numbers: attempts, average score, accuracy, total answers. */
export function StatsGrid({ summary }: { summary: StudentAnalytics["summary"] | undefined }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="সম্পন্ন পরীক্ষা"
        value={formatNumber(summary?.attempts ?? 0)}
        icon={<CircleCheck className="size-4" aria-hidden />}
        hint={summary?.released ? `${formatNumber(summary.released)}টি প্রকাশিত ফলাফল` : "প্রথম পরীক্ষা দিন"}
        tone="brand"
      />
      <StatCard
        label="গড় স্কোর"
        value={formatNumber(summary?.avg_score ?? 0, "bn")}
        icon={<TrendingUp className="size-4" aria-hidden />}
        hint={summary?.best_score ? `সর্বোচ্চ ${formatNumber(summary.best_score)}` : "এখনো কোনো স্কোর নেই"}
        tone="success"
      />
      <StatCard
        label="নির্ভুলতা"
        value={formatNumber(summary?.avg_accuracy ?? 0)}
        suffix="%"
        icon={<Target className="size-4" aria-hidden />}
        hint={summary?.correct ? `${formatNumber(summary.correct)} সঠিক উত্তর` : "উত্তর দেওয়া প্রশ্নের ভিত্তিতে"}
        tone="accent"
      />
      <StatCard
        label="মোট উত্তর"
        value={formatNumber((summary?.correct ?? 0) + (summary?.wrong ?? 0) + (summary?.unanswered ?? 0))}
        icon={<BookOpenCheck className="size-4" aria-hidden />}
        hint={
          summary
            ? `${formatNumber(summary.correct)} সঠিক · ${formatNumber(summary.wrong)} ভুল`
            : "এখনো কোনো উত্তর নেই"
        }
        tone="neutral"
      />
    </div>
  );
}
