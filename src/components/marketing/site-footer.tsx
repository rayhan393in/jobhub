import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const COLUMNS = [
  {
    title: "প্রস্তুতি",
    links: [
      { href: "/courses/bcs", label: "BCS প্রস্তুতি" },
      { href: "/courses/bank-jobs", label: "ব্যাংক জবস" },
      { href: "/courses/government-jobs", label: "সরকারি চাকরি" },
      { href: "/courses/primary-teacher", label: "প্রাথমিক শিক্ষক" },
      { href: "/courses/ntrca", label: "NTRCA" },
      { href: "/courses/eee", label: "EEE ও ইঞ্জিনিয়ারিং" },
    ],
  },
  {
    title: "প্ল্যাটফর্ম",
    links: [
      { href: "/exams", label: "লাইভ পরীক্ষা" },
      { href: "/practice", label: "প্র্যাকটিস সেন্টার" },
      { href: "/custom-exam", label: "কাস্টম পরীক্ষা" },
      { href: "/leaderboard", label: "লিডারবোর্ড" },
      { href: "/routines", label: "স্টাডি রুটিন" },
    ],
  },
  {
    title: "JobHub",
    links: [
      { href: "/about", label: "আমাদের সম্পর্কে" },
      { href: "/contact", label: "যোগাযোগ" },
      { href: "/faq", label: "সাধারণ প্রশ্ন" },
      { href: "/privacy", label: "প্রাইভেসি পলিসি" },
      { href: "/terms", label: "শর্তাবলি" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo size={38} />
            <p className="mt-4 max-w-xs text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
              বাংলাদেশের প্রতিযোগিতামূলক পরীক্ষার জন্য যাচাইকৃত প্রশ্নব্যাংক, সময়সূচি-ভিত্তিক লাইভ
              পরীক্ষা এবং বাস্তব ফলাফলভিত্তিক পারফরম্যান্স বিশ্লেষণ।
            </p>
            <div className="mt-5 space-y-2 text-[0.8125rem] text-[var(--text-muted)]">
              <p className="flex items-center gap-2">
                <Mail className="size-3.5 text-[var(--brand)]" aria-hidden />
                support@jobhub.com.bd
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="size-3.5 text-[var(--brand)]" aria-hidden />
                ঢাকা, বাংলাদেশ · সময় অঞ্চল Asia/Dhaka
              </p>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[var(--text-subtle)]">
                {col.title}
              </h3>
              <ul className="mt-3.5 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[0.8125rem] text-[var(--text-muted)] transition-colors hover:text-[var(--brand)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-[var(--border)] pt-6 text-[0.75rem] text-[var(--text-subtle)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} JobHub. সর্বস্বত্ব সংরক্ষিত।</p>
          <p className="max-w-xl leading-relaxed">
            JobHub একটি স্বাধীন প্রস্তুতি প্ল্যাটফর্ম। কোনো সরকারি সংস্থা, ব্যাংক বা কমিশনের সাথে
            সম্পর্কিত নয়। সিলেবাস-রূপরেখাগুলো সম্পাদনা-ভিত্তিক, অফিসিয়াল নয়।
          </p>
        </div>
      </div>
    </footer>
  );
}
