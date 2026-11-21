"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LogIn, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { getBrowserClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(
          signInError.message.toLowerCase().includes("invalid login")
            ? "ইমেইল বা পাসওয়ার্ড সঠিক নয়।"
            : "লগইন সম্পন্ন হয়নি। আবার চেষ্টা করুন।",
        );
        return;
      }
      router.replace(next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("not configured")
          ? "এই ডিপ্লয়মেন্টে Supabase কনফিগার করা নেই।"
          : "লগইন সম্পন্ন হয়নি। আবার চেষ্টা করুন।",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-[0.8125rem] font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}

      <Field label="ইমেইল" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field label="পাসওয়ার্ড" htmlFor="password" required>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[var(--text-subtle)] hover:text-[var(--text)]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <Button type="submit" className="w-full" size="lg" loading={loading}>
        {!loading ? <LogIn className="size-4" aria-hidden /> : null}
        লগইন
      </Button>

      <p className="text-center text-[0.8125rem] text-[var(--text-muted)]">
        নতুন অ্যাকাউন্ট?{" "}
        <Link href="/register" className="font-semibold text-[var(--brand)] hover:underline">
          বিনামূল্যে রেজিস্ট্রেশন করুন
        </Link>
      </p>
    </form>
  );
}
