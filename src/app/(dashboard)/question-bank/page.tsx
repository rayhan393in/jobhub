import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BookOpenCheck, Building2, GraduationCap, Landmark, Library, ShieldCheck,
  SlidersHorizontal, Sparkles, Zap,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getCollectionCounts } from "@/lib/question-bank";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "প্রশ্নব্যাংক" };

const EMPTY_NOTE = "এখনো কোনো যাচাইকৃত প্রশ্ন যোগ হয়নি";

export default async function QuestionBankPage() {
  const counts = await getCollectionCounts();
  const verified = (slug: string) => counts.get(slug)?.total_verified ?? 0;
  const previous = (slug: string) => counts.get(slug)?.previous_verified ?? 0;
  const sum = (slugs: string[]) => slugs.reduce((acc, slug) => acc + verified(slug), 0);

  const bcsPrevious = previous("bcs");
  const bcsTotal = verified("bcs");
  const bankCount = verified("government-jobs");
  const govtCount = sum(["government-jobs", "ntrca", "primary-teacher"]);
  const eeeCount = sum(["eee", "technical-recruitment", "petrobangla-ae-eee"]);
  const admissionCount = verified("university-admission");
  const allVerified = [...counts.values()].reduce((acc, row) => acc + row.total_verified, 0);
  const privateCount = verified("private-jobs");

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow="প্রশ্নব্যাংক"
        title="যাচাইকৃত প্রশ্ন — খুঁজুন, অনুশীলন করুন, মূল্যায়ন করুন"
        description="শুধু অনুমোদিত ও যাচাইকৃত প্রশ্ন দেখা যায়। প্রতিটি প্রশ্নের সাথে মূল পরীক্ষা, বছর ও উৎস সংরক্ষিত — সংখ্যাগুলো সরাসরি ডেটাবেস থেকে।"
      />

      {/* ------- BCS Previous Year — the most prominent collection ------- */}
      <section
        aria-label="BCS Previous Year Questions"
        className="relative overflow-hidden rounded-2xl border border-[var(--brand)]/25 bg-gradient-to-br from-[var(--brand-soft)] via-[var(--surface)] to-[var(--surface)] p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-white">
              <ShieldCheck className="size-3.5" aria-hidden />
              BCS Previous Year Questions
            </span>
            <h2 className="mt-3 text-balance text-[1.375rem] font-bold leading-tight tracking-[-0.02em] text-[var(--text)]">
              বিসিএস পূর্ববর্তী বছরের প্রশ্নব্যাংক
            </h2>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
              পরীক্ষা নম্বর, বছর, বিষয়, টপিক ও সাবটপিক ধরে ফিল্টার করুন। প্রতিটি প্রশ্নের সাথে মূল পরীক্ষা, বছর ও যাচাই-অবস্থা সংরক্ষিত থাকে; AI-সহায়ক বা যাচাই-বিহীন কোনো প্রশ্ন কখনো “পূর্ববর্তী বছর” হিসেবে দেখা যায় না।
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.6875rem] font-medium text-[var(--text-muted)]">
              <Badge tone="success" dot>যাচাইকৃত</Badge>
              <Badge tone="neutral">মূল উৎস সংরক্ষিত</Badge>
              <Badge tone="neutral">বছরভিত্তিক ফিল্টার</Badge>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:min-w-[13rem] sm:items-center sm:text-center">
            <p className="text-[2.5rem] font-extrabold leading-none tracking-[-0.04em] text-[var(--brand)]">
              {formatNumber(bcsPrevious)}
            </p>
            <p className="text-[0.6875rem] font-semibold text-[var(--text-muted)]">যাচাইকৃত পূর্ববর্তী বছরের প্রশ্ন</p>
            <p className="text-[0.625rem] text-[var(--text-subtle)]">বিসিএস কোর্সে মোট {formatNumber(bcsTotal)}টি যাচাইকৃত প্রশ্ন</p>
            <ButtonLink href="/question-bank/bcs" size="sm" className="mt-1 w-full">
              প্রশ্ন দেখুন
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ------- Other collections ------- */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CollectionCard
          icon={<Landmark className="size-5" aria-hidden />}
          title="Bank Recruitment Questions"
          titleBn="ব্যাংক নিয়োগ"
          description="ব্যাংক রিক্রুটমেন্ট ও ব্যাংক চাকরির প্রস্তুতি — সরকারি চাকরি কোর্সের যাচাইকৃত প্রশ্নব্যাংক থেকে অনুশীলন করুন।"
          count={bankCount}
          href="/practice?course=government-jobs"
          cta="প্র্যাকটিস করুন"
        />
        <CollectionCard
          icon={<Building2 className="size-5" aria-hidden />}
          title="Government Job Questions"
          titleBn="সরকারি চাকরি"
          description="সরকারি চাকরি, প্রাথমিক শিক্ষক ও NTRCA কোর্সের যাচাইকৃত প্রশ্ন — একটি লাইনেই।"
          count={govtCount}
          href="/practice?course=government-jobs"
          cta="প্র্যাকটিস করুন"
        />
        <CollectionCard
          icon={<Zap className="size-5" aria-hidden />}
          title="EEE & Technical Questions"
          titleBn="ইইই ও টেকনিক্যাল"
          description="ইইই, ইঞ্জিনিয়ারিং ও টেকনিক্যাল নিয়োগ কোর্সের যাচাইকৃত প্রশ্ন।"
          count={eeeCount}
          href="/practice?course=eee"
          cta="প্র্যাকটিস করুন"
        />
        <CollectionCard
          icon={<GraduationCap className="size-5" aria-hidden />}
          title="University Admission Questions"
          titleBn="বিশ্ববিদ্যালয় ভর্তি"
          description="ঢাবি, রাবি, চবিসহ পাবলিক বিশ্ববিদ্যালয় ভর্তি পরীক্ষার যাচাইকৃত প্রশ্ন।"
          count={admissionCount}
          href="/practice?course=university-admission"
          cta="প্র্যাকটিস করুন"
        />
        <CollectionCard
          icon={<Library className="size-5" aria-hidden />}
          title="Subject-wise Practice"
          titleBn="বিষয়ভিত্তিক অনুশীলন"
          description="যেকোনো কোর্সের যেকোনো বিষয় বেছে নিয়ে যাচাইকৃত প্রশ্ন দিয়ে অনুশীলন করুন।"
          count={allVerified}
          href="/practice"
          cta="অনুশীলন শুরু করুন"
        />
        <CollectionCard
          icon={<SlidersHorizontal className="size-5" aria-hidden />}
          title="Custom Practice"
          titleBn="কাস্টম প্র্যাকটিস"
          description="একাধিক বিষয়, টপিক, প্রশ্নসংখ্যা, কঠিনতা ও সময় বেছে নিজের পরীক্ষা নিজেই গড়ুন।"
          count={allVerified}
          href="/custom-exam"
          cta="পরীক্ষা তৈরি করুন"
        />
        <CollectionCard
          icon={<BookOpenCheck className="size-5" aria-hidden />}
          title="Private & Other Jobs"
          titleBn="বেসরকারি চাকরি"
          description="বেসরকারি চাকরির কোর্সের যাচাইকৃত প্রশ্নব্যাংক।"
          count={privateCount}
          href="/practice?course=private-jobs"
          cta="প্র্যাকটিস করুন"
        />
      </div>

      {/* ------- Classification legend: how a question earns its label ------- */}
      <section aria-labelledby="legend-h" className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 id="legend-h" className="flex items-center gap-2 text-[0.875rem] font-semibold text-[var(--text)]">
          <Sparkles className="size-4 text-[var(--brand)]" aria-hidden />
          প্রতিটি প্রশ্নের শ্রেণিবিভাগ
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LegendItem
            badge={<Badge tone="success">PYQ</Badge>}
            title="পূর্ববর্তী বছরের প্রশ্ন"
            text="অনুমোদিত ও যাচাইকৃত; মূল পরীক্ষা, বছর ও উৎস রেফারেন্স সংরক্ষিত। এভাবেই “BCS Previous Year” হিসেবে চিহ্নিত হয়।"
          />
          <LegendItem
            badge={<Badge tone="neutral">SIMILAR</Badge>}
            title="Similar Concept Question"
            text="আগের প্রশ্নের ধারণার কাছাকাছি তৈরি; মিলের শনাক্তি প্রশাসক যাচাই করেন — পূর্ববর্তী বছর হিসেবে গণ্য হয় না।"
          />
          <LegendItem
            badge={<Badge tone="neutral">PRACTICE</Badge>}
            title="Practice Question"
            text="নিয়মিত অনুশীলনের জন্য যাচাইকৃত প্রশ্ন; পূর্ববর্তী বছরের দাবি ছাড়া।"
          />
          <LegendItem
            badge={<Badge tone="warning">AI</Badge>}
            title="AI-Generated Question"
            text="AI-সহায়তায় খসড়া — ইমপোর্টের পর ‘রিভিউ অপেক্ষায়’ হিসেবে ঢোকে; মানুষের যাচাই ছাড়া প্রকাশিত হয় না।"
          />
        </div>
        <p className="mt-3 border-t border-[var(--border)] pt-3 text-[0.6875rem] leading-relaxed text-[var(--text-subtle)]">
          যাচাই-প্রবাহ: ইমপোর্ট → রিভিউ অপেক্ষায় → যাচাই ও অনুমোদন → প্রকাশ। সংখ্যাগুলো যেকোনো সময় সরাসরি ডেটাবেস থেকে নেওয়া; কোনো সংখ্যা অনুমান করে দেখানো হয় না।
        </p>
      </section>
    </div>
  );
}

function CollectionCard({
  icon,
  title,
  titleBn,
  description,
  count,
  href,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  titleBn: string;
  description: string;
  count: number;
  href: string;
  cta: string;
}) {
  return (
    <div className="jh-card flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          {icon}
        </span>
        <span className="text-right">
          <span className="block text-[1.375rem] font-extrabold leading-none tracking-[-0.03em] text-[var(--text)]">
            {formatNumber(count)}
          </span>
          <span className="mt-0.5 block text-[0.5625rem] font-medium text-[var(--text-subtle)]">যাচাইকৃত প্রশ্ন</span>
        </span>
      </div>
      <h3 className="mt-3 text-[0.9375rem] font-bold tracking-[-0.01em] text-[var(--text)]">
        {title}
        <span className="ml-2 text-[0.75rem] font-semibold text-[var(--text-subtle)]">· {titleBn}</span>
      </h3>
      <p className="mt-1 flex-1 text-[0.75rem] leading-relaxed text-[var(--text-muted)]">{description}</p>
      {count === 0 ? (
        <p className="mt-2 text-[0.625rem] font-medium text-[var(--text-subtle)]">{EMPTY_NOTE}</p>
      ) : null}
      <Link
        href={href}
        className="mt-3 inline-flex w-fit items-center gap-1.5 text-[0.75rem] font-semibold text-[var(--brand)] hover:underline"
      >
        {cta}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function LegendItem({
  badge,
  title,
  text,
}: {
  badge: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] p-3">
      <div className="flex items-center gap-2">
        {badge}
        <p className="text-[0.75rem] font-semibold text-[var(--text)]">{title}</p>
      </div>
      <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">{text}</p>
    </div>
  );
}
