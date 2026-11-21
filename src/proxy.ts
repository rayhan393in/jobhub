import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session cookie and gates private routes.
 *
 * The middleware only checks "is there a session"; fine-grained role checks
 * happen server-side in layouts/route handlers backed by RLS.
 */

const PROTECTED_PREFIXES = ["/dashboard", "/practice", "/admin", "/account"];
const AUTH_PAGES = ["/login", "/register"];

/**
 * `/login` is normally off-limits once you are signed in, but two flows need a
 * signed-in visitor to see it:
 *   - `/admin/login` forwards a signed-in non-staff user to sign in again with a
 *     staff account, so a hard redirect would loop forever.
 *   - the first-admin claim panel lives there.
 */
function keepsSignInPage(request: NextRequest) {
  // A `next` parameter means the visitor was deliberately sent here by a guard;
  // honour it instead of bouncing them to the dashboard.
  return request.nextUrl.pathname === "/login" && request.nextUrl.searchParams.has("next");
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({ request });

  // Without Supabase configuration the app still renders (setup mode).
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  const isAuthPage = AUTH_PAGES.includes(path);

  if (!user && isProtected) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  if (user && isAuthPage && !keepsSignInPage(request)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/dashboard";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|woff2?)$).*)"],
};
