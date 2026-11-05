import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configurationError, getSupabaseConfig } from "@/lib/supabase/env";
import { PublicError } from "@/lib/supabase/errors";

export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) throw new PublicError(configurationError);
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Rendering cannot write cookies; the proxy handles session refresh.
        }
      },
    },
  });
}
