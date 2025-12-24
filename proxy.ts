import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;

  // Auth routes that should never be redirected back to themselves
  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/auth");

  // Routes inside your app that require authentication
  const isProtectedRoute =
    pathname === "/feed" ||
    pathname.startsWith("/feed/") ||
    pathname === "/log" ||
    pathname.startsWith("/log/") ||
    pathname === "/analytics" ||
    pathname.startsWith("/analytics/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/friends" ||
    pathname.startsWith("/friends/");

  // If not logged in and trying to access a protected route, go to login
  if (!user && isProtectedRoute && !isAuthRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // If logged in and trying to access login/signup, send to feed
  if (user && isAuthRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/feed";
    return NextResponse.redirect(url);
  }

  return res;
}

// Apply to all routes except Next internals/static files
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
