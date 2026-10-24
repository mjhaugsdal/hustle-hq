import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configurationError, getSupabaseConfig } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  const isPublic = request.nextUrl.pathname === "/login" || request.nextUrl.pathname.startsWith("/auth/");
  let response = NextResponse.next({ request });
  function login(error?: string) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (error) url.searchParams.set("error", error);
    const redirected = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    return redirected;
  }
  if (!config) return isPublic ? response : login(configurationError);
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if ((!user || error) && !isPublic) return login();
  } catch {
    if (!isPublic) return login("Unable to verify your session. Check your connection and sign in again.");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
