import Link from "next/link";
import { cn } from "@/lib/cn";

export function LogoMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-[0.75rem] text-white shadow-[0_6px_18px_-8px_var(--brand)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: "linear-gradient(150deg, var(--brand) 0%, var(--accent) 100%)",
      }}
      aria-hidden
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 8.6 12 4l8 4.6-8 4.6-8-4.6Z"
          fill="currentColor"
          fillOpacity="0.95"
        />
        <path d="M7 11.2v4.2c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6v-4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M20 8.8v4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Logo({
  href = "/",
  className,
  size = 36,
  showTagline = true,
}: {
  href?: string;
  className?: string;
  size?: number;
  showTagline?: boolean;
}) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="JobHub home">
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="flex items-baseline gap-[0.15em] text-[1.0625rem] font-extrabold tracking-[-0.03em] text-[var(--text)]">
          Job<span className="text-[var(--brand)]">Hub</span>
        </span>
        {showTagline ? (
          <span className="mt-[0.2rem] text-[0.5625rem] font-semibold uppercase tracking-[0.18em] text-[var(--text-subtle)]">
            Bangladesh Exam Prep
          </span>
        ) : null}
      </span>
    </Link>
  );
}
