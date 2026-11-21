import type { Metadata } from "next";
import { Clock3, Mail, MapPin, MessageSquare } from "lucide-react";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "যোগাযোগ",
  description: "JobHub-এর সাথে যোগাযোগ করুন — প্রশ্নের ভুল, সিলেবাস সংযোজন, প্রযুক্তিগত সমস্যা বা অ্যাকাউন্ট সংক্রান্ত সহায়তা।",
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
        যোগাযোগ
      </p>
      <h1 className="mt-2 text-balance text-[1.875rem] font-bold leading-tight tracking-[-0.035em] text-[var(--text)] sm:text-[2.25rem]">
        আপনার মতামত আমাদের কাছে গুরুত্বপূর্ণ
      </h1>
      <p className="mt-3 max-w-2xl text-pretty text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
        কোনো প্রশ্নে ভুল, সিলেবাসে সংযোজনের প্রস্তাব, প্রযুক্তিগত সমস্যা বা অ্যাকাউন্ট-সংক্রান্ত
        সহায়তা দরকার? নিচের ফর্মে লিখুন বা সরাসরি ইমেইল করুন।
      </p>

      <div className="mt-9 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <ContactForm />

        <aside className="space-y-4">
          {[
            {
              icon: <Mail className="size-4" />,
              title: "ইমেইল",
              lines: ["support@jobhub.com.bd", "২৪–৪৮ ঘণ্টার মধ্যে উত্তর"],
            },
            {
              icon: <Clock3 className="size-4" />,
              title: "সহায়তার সময়",
              lines: ["শনি–বৃহস্পতি, সকাল ১০টা – রাত ১০টা (Asia/Dhaka)"],
            },
            {
              icon: <MapPin className="size-4" />,
              title: "অবস্থান",
              lines: ["ঢাকা, বাংলাদেশ"],
            },
            {
              icon: <MessageSquare className="size-4" />,
              title: "প্রশ্ন রিপোর্ট",
              lines: ["প্রশ্নের আইডি বা স্ক্রিনশট দিলে দ্রুত যাচাই করা সহজ হয়।"],
            },
          ].map((item) => (
            <div key={item.title} className="jh-card p-4">
              <div className="flex items-center gap-2 text-[var(--brand)]">
                {item.icon}
                <h2 className="text-[0.875rem] font-semibold text-[var(--text)]">{item.title}</h2>
              </div>
              <div className="mt-1.5 space-y-0.5 text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                {item.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
