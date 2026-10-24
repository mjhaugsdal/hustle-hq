import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/supabase/errors";

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const destination = new URL("/login", request.url);
  if (!token_hash || !type || !["invite", "email"].includes(type)) {
    destination.searchParams.set("error", "This invitation link is invalid or incomplete.");
    return NextResponse.redirect(destination);
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as EmailOtpType });
    destination.searchParams.set(error ? "error" : "notice", error
      ? "This invitation link has expired or was already used. Ask your administrator for a new invitation."
      : "Email verified. Sign in with the password set by your workspace administrator.");
  } catch (error) {
    destination.searchParams.set("error", errorMessage(error));
  }
  return NextResponse.redirect(destination);
}
