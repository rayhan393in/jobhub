import type { Metadata } from "next";
import { BadgeCheck, BookOpenCheck, Compass, ShieldCheck, Target, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "আমাদের সম্পর্কে",
  description:
    "JobHub কেন তৈরি, আমরা কীভাবে প্রশ্ন যাচাই করি, এবং বাংলাদেশের প্রতিযোগিতামূলক পরীক্ষার প্রস্তুতিতে কী দায়িত্ব নিই।",
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
        আমাদের সম্পর্কে
      </p>
      <h1 className="mt-2 text-balance text-[1.875rem] font-bold leading-tight tracking-[-0.035em] text-[var(--text)] sm:text-[2.25rem]">
        প্রস্তুতির মানে শুধু বেশি প্রশ্ন নয় — সঠিক প্রশ্ন
      </h1>
      <p className="mt-4 max-w-2xl text-pretty text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
        বাংলাদেশে প্রতিযোগিতামূলক পরীক্ষার প্রস্তুতি নিতে গিয়ে শিক্ষার্থীরা প্রায়ই যাচাইহীন প্রশ্ন,
        ভুল উত্তরমালা এবং অপরিষ্কার বিশ্লেষণের মুখোমুখি হন। JobHub তৈরি হয়েছে সেই সমস্যাগুলো কমাতে —
        যাচাইকৃত প্রশ্ন, সার্ভার-নিয়ন্ত্রিত মূল্যায়ন এবং আপনার নিজের ফলাফলের উপর ভিত্তি করে সৎ
        বিশ্লেষণ নিয়ে।
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {[
          {
            icon: <Target className="size-5" />,
            title: "আমাদের লক্ষ্য",
            text: "প্রতিটি শিক্ষার্থীর প্রস্তুতিকে পরিমাপযোগ্য এবং দিকনির্দেশিত করা — শুধু অনুভূতির উপর নির্ভর না করে বাস্তব ডেটায় অগ্রগতি দেখা।",
          },
          {
            icon: <ShieldCheck className="size-5" />,
            title: "আমাদের নীতি",
            text: "কোনো প্রশ্ন যাচাই ও অনুমোদন ছাড়া পরীক্ষায় আসে না। AI-সহায়তায় তৈরি কোনো প্রশ্ন কখনো স্বয়ংক্রিয়ভাবে যাচাইকৃত হিসেবে গণ্য হয় না।",
          },
          {
            icon: <BookOpenCheck className="size-5" />,
            title: "আমাদের সিলেবাস",
            text: "বিষয়-টপিক রূপরেখা সম্পাদনা-ভিত্তিক অধ্যয়ন-পরিকল্পনা, অফিসিয়াল সিলেবাস নয়। আমরা কোনো সিলেবাসের ‘সম্পূর্ণতা’ দাবি করি না।",
          },
          {
            icon: <Compass className="size-5" />,
            title: "আমাদের পথচলা",
            text: "প্রথমে BCS, তারপর বিশ্ববিদ্যালয় ভর্তি, সরকারি চাকরি, প্রাথমিক শিক্ষক, NTRCA এবং EEE — ধাপে ধাপে প্রতিটি কোর্সের নিজস্ব প্রশ্নব্যাংক তৈরি হচ্ছে।",
          },
        ].map((item) => (
          <div key={item.title} className="jh-card p-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
              {item.icon}
            </span>
            <h2 className="mt-3.5 text-[0.9375rem] font-semibold text-[var(--text)]">{item.title}</h2>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">{item.text}</p>
          </div>
        ))}
      </div>

      <section className="mt-12" aria-labelledby="integrity-heading">
        <h2 id="integrity-heading" className="text-[1.25rem] font-bold tracking-[-0.02em] text-[var(--text)]">
          আমরা যা করি না
        </h2>
        <ul className="mt-4 space-y-3">
          {[
            "শিক্ষার্থীর সংখ্যা, টেস্টিমোনিয়াল বা “সাফল্যের হার” বানিয়ে দেখাই না — যতটুকু বাস্তব ডেটা আছে, ততটুকুই দেখাই।",
            "অফিসিয়াল সিলেবাস বা সরকারি প্রশ্ন বলে যাচাইহীন কনটেন্ট প্রচার করি না।",
            "স্বয়ংক্রিয়ভাবে তৈরি প্রশ্ন সরাসরি পরীক্ষায় ঢুকিয়ে দিই না — প্রতিটি প্রশ্ন সম্পাদকীয় পর্যালোচনা পায়।",
            "শিক্ষার্থীর ব্যক্তিগত উত্তর বা অসম্পূর্ণ পরীক্ষার তথ্য আমরা কারো সাথে দেখাই না।",
          ].map((item) => (
            <li key={item} className="flex gap-2.5 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="flex items-center gap-2 text-[1.0625rem] font-semibold text-[var(--text)]">
          <Users className="size-4.5 text-[var(--brand)]" aria-hidden />
          আপনার মতামত গুরুত্বপূর্ণ
        </h2>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          কোনো প্রশ্নে ভুল পেলে বা সিলেবাসে কিছু যোগ করতে চাইলে আমাদের জানান —
          <a href="/contact" className="font-semibold text-[var(--brand)] hover:underline">
            যোগাযোগ
          </a>{" "}
          পেজ থেকে আপনার পর্যবেক্ষণ পাঠান। প্রতিটি রিপোর্ট সম্পাদকীয় পর্যালোচনায় যায়।
        </p>
      </section>
    </div>
  );
}
