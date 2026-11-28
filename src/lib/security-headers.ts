/**
 * Single source of truth for the security headers, used by next.config.ts.
 *
 * These were previously declared twice — once in next.config.ts and once in
 * vercel.json — which is a silent-drift hazard: editing one left the other
 * serving stale values. vercel.json keeps only framework/region settings now.
 *
 * The CSP is deliberately aligned with how the app actually loads assets:
 *   - `script-src 'unsafe-inline'`: the root layout inlines `themeScript` to set
 *     the colour scheme before first paint (avoids a dark-mode flash). Replacing
 *     that with a nonce would require middleware-driven nonces on every render.
 *   - `connect-src` must include the Supabase origin, because the browser client
 *     talks to PostgREST and Storage directly with the anon key.
 *   - `frame-ancestors 'self'` mirrors X-Frame-Options; both are kept so older
 *     browsers still get the frame protection.
 *   - `blob:`/`data:` in img-src and worker-src cover the client-side sheet
 *     print/preview path and the dynamically imported xlsx parser.
 */

const SUPABASE_ORIGIN = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
})();

export function contentSecurityPolicy(): string {
  const connect = ["'self'", SUPABASE_ORIGIN, "https://*.supabase.co", "wss://*.supabase.co"].filter(
    Boolean,
  );

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    `connect-src ${connect.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function securityHeaders(): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy() },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  ];
}
