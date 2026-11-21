import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { PLATFORM_FAQ } from "@/components/marketing/faq-data";

export const metadata: Metadata = {
  title: "সাধারণ প্রশ্ন",
  description: "JobHub ব্যবহার, প্রশ্নের যাচাইকরণ, নম্বরকরণ, ফলাফল প্রকাশ এবং ব্যক্তিগত তথ্যের সুরক্ষা নিয়ে সাধারণ প্রশ্নের উত্তর।",
};

const EXAM_FAQ = [
  {
    question: "কাস্টম পরীক্ষায় কতটি প্রশ্ন ও কত সময় দিতে পারি?",
    answer:
      "প্রশাসক-নির্ধারিত সীমার মধ্যে (ডিফল্টে সর্বোচ্চ ১০০ প্রশ্ন এবং ১৮০ মিনিট) আপনি বিষয়, টপিক বা সাবটপিক বেছে নিয়ে প্রশ্নসংখ্যা ও সময় নির্ধারণ করতে পারেন। প্রতিটি নির্বাচনে কতগুলো যাচাইকৃত প্রশ্ন আছে তা আগেই দেখা যায়; পর্যাপ্ত প্রশ্ন না থাকলে প্ল্যাটফর্ম কম প্রশ্ন দিয়ে ‘চালিয়ে যায়’ না — স্পষ্ট বার্তা দেখায়।",
  },
  {
    question: "মার্ক-ফর-রিভিউ মানে কী?",
    answer:
      "একটি প্রশ্নে উত্তর দেওয়ার পরেও আপনি সেটি পর্যালোচনার জন্য চিহ্নিত করতে পারেন, যাতে শেষে প্রশ্ন গ্রিড থেকে সহজে খুঁজে পান। এই চিহ্ন শুধু আপনার ব্রাউজারে এবং সংরক্ষিত উত্তরসহ সার্ভারে সংরক্ষিত থাকে — অন্য কেউ দেখে না।",
  },
  {
    question: "উত্তর স্বয়ংক্রিয়ভাবে সংরক্ষিত হয় কি না কীভাবে বুঝব?",
    answer:
      "পরীক্ষার স্ক্রিনে সবসময় সেভিং, সংরক্ষিত ও ত্রুটি — এই তিন অবস্থার একটি স্পষ্টভাবে দেখা যায়। ত্রুটি দেখালে আপনার উত্তর সার্ভারে পৌঁছায়নি; সংযোগ ফিরে এলে আবার চেষ্টা হবে। এই সময় প্ল্যাটফর্ম সাবমিশন আটকে রাখে যাতে অসম্পূর্ণ উত্তর জমা না পড়ে।",
  },
  {
    question: "একই সময়ে লাইভ পরীক্ষা ও সাপ্তাহিক স্পেশাল থাকতে পারে?",
    answer:
      "হ্যাঁ। একটি নির্ধারিত দিনে দৈনিক লাইভ এবং সাপ্তাহিক স্পেশাল —দুটোই আলাদা স্লটে থাকতে পারে, কারণ প্রতিটি পরীক্ষার নিজস্ব সময় ও কাঠামো থাকে। কিন্তু একই কোর্স ও একই শুরুর সময়ে দুটি সবেমাত্র কার্যকর পরীক্ষা প্রকাশ করা যায় না।",
  },
  {
    question: "লিডারবোর্ডে কে কোথায় থাকবেন কীভাবে নির্ধারিত হয়?",
    answer:
      "কেবল প্রকাশিত (released) ফলাফলই লিডারবোর্ডে যায়। সমান স্কোরে ক্রম নির্ধারিত হয়: বেশি নির্ভুলতা → কম সময়ে সম্পন্ন → আগে জমা দেওয়া → ইউজার আইডি। এই ক্রম নির্দিষ্ট (deterministic), তাই প্রতিবার একই ফলাফল আসে।",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
        সহায়তা কেন্দ্র
      </p>
      <h1 className="mt-2 text-balance text-[1.875rem] font-bold leading-tight tracking-[-0.035em] text-[var(--text)] sm:text-[2.25rem]">
        সাধারণ প্রশ্ন ও উত্তর
      </h1>
      <p className="mt-3 text-pretty text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
        প্ল্যাটফর্ম, পরীক্ষা ও তথ্য সুরক্ষা নিয়ে সবচেয়ে বেশি জিজ্ঞাসিত প্রশ্নগুলো এখানে সাজানো আছে।
        আপনার উত্তর না পেলে{" "}
        <Link href="/contact" className="font-semibold text-[var(--brand)] hover:underline">
          আমাদের লিখুন
        </Link>
        ।
      </p>

      <h2 className="mb-4 mt-10 text-[1.0625rem] font-semibold text-[var(--text)]">প্ল্যাটফর্ম</h2>
      <FaqAccordion items={PLATFORM_FAQ} />

      <h2 className="mb-4 mt-10 text-[1.0625rem] font-semibold text-[var(--text)]">পরীক্ষা</h2>
      <FaqAccordion items={EXAM_FAQ.map((f) => ({ ...f, answer: f.answer.replace("দুটোই", "দুটোই") }))} />
    </div>
  );
}
