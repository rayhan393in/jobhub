import Link from "next/link";
import { ShieldCheck, Sparkles, Target } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Brand panel */}
      <aside className="jh-hero-field relative hidden flex-col justify-between overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] p-10 lg:flex xl:p-14">
        <div className="jh-grid-lines pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="relative">
          <Logo size={38} />
        </div>
        <div className="relative max-w-md">
          <h1 className="text-balance text-[2rem] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--text)] xl:text-[2.375rem]">
            প্রতিদিনের প্রস্তুতি,{" "}
            <span className="bg-[linear-gradient(100deg,var(--brand),var(--accent))] bg-clip-text text-transparent">
              বাস্তব অগ্রগতি।
            </span>
          </h1>
          <p className="mt-4 text-pretty text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
            যাচাইকৃত প্রশ্নব্যাংক, সময়সূচি-ভিত্তিক লাইভ পরীক্ষা, এবং আপনার নিজের ফলাফল থেকে তৈরি
            পারফরম্যান্স বিশ্লেষণ — সব এক জায়গায়।
          </p>
          <ul className="mt-8 space-y-4">
            {[
              {
                icon: <ShieldCheck className="size-4" />,
                title: "যাচাইকৃত প্রশ্ন",
                text: "প্রতিটি প্রশ্ন শিক্ষার্থীর সামনে আসার আগে সম্পাদকীয় পর্যালোচনা পায়।",
              },
              {
                icon: <Target className="size-4" />,
                title: "সার্ভার-নিয়ন্ত্রিত পরীক্ষা",
                text: "উত্তর অটো-সেভ, রিফ্রেশে পুনরুদ্ধার এবং নিরাপদ স্কোরিং।",
              },
              {
                icon: <Sparkles className="size-4" />,
                title: "দুর্বল টপিক চিহ্নিতকরণ",
                text: "আপনার প্রকৃত উত্তর থেকে বিষয় ও টপিকভিত্তিক বিশ্লেষণ।",
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  {item.icon}
                </span>
                <span>
                  <span className="block text-[0.875rem] font-semibold text-[var(--text)]">{item.title}</span>
                  <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                    {item.text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[0.75rem] text-[var(--text-subtle)]">
          © {new Date().getFullYear()} JobHub · ঢাকা, বাংলাদেশ
        </p>
      </aside>

      {/* Form panel */}
      <main id="main" className="flex flex-1 flex-col bg-[var(--surface-muted)]">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8 lg:justify-end">
          <span className="lg:hidden">
            <Logo size={32} showTagline={false} />
          </span>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-8">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>
        <div className="px-5 pb-6 text-center text-[0.75rem] text-[var(--text-subtle)] sm:px-8">
          <Link href="/faq" className="hover:text-[var(--brand)]">
            সহায়তা দরকার?
          </Link>
          <span aria-hidden> · </span>
          <Link href="/privacy" className="hover:text-[var(--brand)]">
            প্রাইভেসি
          </Link>
          <span aria-hidden> · </span>
          <Link href="/terms" className="hover:text-[var(--brand)]">
            শর্তাবলি
          </Link>
        </div>
      </main>
    </div>
  );
}
