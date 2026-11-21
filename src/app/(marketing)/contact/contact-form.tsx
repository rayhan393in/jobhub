"use client";

import * as React from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

const TOPICS = [
  { value: "question-error", label: "প্রশ্নে ভুল বা সংশোধন" },
  { value: "syllabus", label: "সিলেবাস/টপিক সংযোজনের প্রস্তাব" },
  { value: "technical", label: "প্রযুক্তিগত সমস্যা" },
  { value: "account", label: "অ্যাকাউন্ট সংক্রান্ত সহায়তা" },
  { value: "other", label: "অন্যান্য" },
];

export function ContactForm() {
  const [sent, setSent] = React.useState(false);
  const [topic, setTopic] = React.useState(TOPICS[0].value);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("আপনার নাম লিখুন।");
    if (!email.includes("@")) return setError("সঠিক ইমেইল দিন।");
    if (message.trim().length < 15) return setError("অন্তত ১৫ অক্ষরের বার্তা লিখুন।");
    setSent(true);
  }

  if (sent) {
    return (
      <div className="jh-card flex flex-col items-start gap-3 p-6">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-mint-50 text-mint-600 dark:bg-mint-600/15 dark:text-mint-500">
          <CheckCircle2 className="size-5" aria-hidden />
        </span>
        <h2 className="text-[1rem] font-semibold text-[var(--text)]">বার্তা প্রস্তুত হয়েছে</h2>
        <p className="text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          এই ফর্মটি একটি স্ট্যাটিক প্রিভিউ — বার্তা সরাসরি পাঠানোর জন্য আপনার ইমেইল ক্লায়েন্টে নিচের
          ঠিকানায় লিখুন। আমরা প্রতিটি রিপোর্ট পর্যালোচনা করি।
        </p>
        <a
          href={`mailto:support@jobhub.com.bd?subject=${encodeURIComponent(
            `[JobHub] ${TOPICS.find((t) => t.value === topic)?.label ?? "Contact"} — ${name}`,
          )}&body=${encodeURIComponent(`${message}\n\n— ${name} (${email})`)}`}
          className="text-[0.875rem] font-semibold text-[var(--brand)] hover:underline"
        >
          support@jobhub.com.bd-এ ইমেইল খুলুন →
        </a>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-[0.75rem] font-medium text-[var(--text-subtle)] hover:text-[var(--text)]"
        >
          নতুন বার্তা লিখুন
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="jh-card space-y-4 p-5 sm:p-6" noValidate>
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[0.8125rem] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <Field label="আপনার নাম" htmlFor="contact-name" required>
        <Input id="contact-name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>

      <Field label="ইমেইল" htmlFor="contact-email" required>
        <Input
          id="contact-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>

      <Field label="বিষয়" htmlFor="contact-topic">
        <Select id="contact-topic" name="topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="বার্তা" htmlFor="contact-message" required hint="প্রশ্নের আইডি বা স্ক্রিনশটের বর্ণনা দিলে দ্রুত যাচাই করা সহজ হয়।">
        <Textarea
          id="contact-message"
          name="message"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
      </Field>

      <Button type="submit" className="w-full">
        <Send className="size-4" aria-hidden />
        বার্তা পাঠান
      </Button>
    </form>
  );
}
