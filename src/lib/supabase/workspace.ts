import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { checkDatabase, PublicError } from "@/lib/supabase/errors";

export async function resolveWorkspace() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new PublicError("Your session has expired. Sign in again.");
  const membership = await supabase.from("workspace_members").select("workspace_id").eq("user_id", user.id).limit(2);
  checkDatabase(membership.error);
  if (membership.data?.length !== 1) {
    throw new PublicError("Your account needs exactly one workspace membership. Ask your workspace administrator to invite you.");
  }
  return { supabase, user, workspaceId: membership.data[0].workspace_id as string };
}

export const requireWorkspace = cache(resolveWorkspace);

export type WorkspaceContext = Awaited<ReturnType<typeof requireWorkspace>>;

export async function requireIdea(context: WorkspaceContext, ideaId: string) {
  const result = await context.supabase.from("ideas").select("id,is_shortlisted")
    .eq("id", ideaId).eq("workspace_id", context.workspaceId).maybeSingle();
  checkDatabase(result.error);
  if (!result.data) throw new PublicError("Idea not found in your workspace. Refresh and try again.");
  return result.data;
}
