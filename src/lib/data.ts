import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { WorkspaceData } from "@/lib/domain";
import { requireWorkspace } from "@/lib/supabase/workspace";
import { checkDatabase, errorMessage } from "@/lib/supabase/errors";

export const getWorkspaceData = cache(async (): Promise<WorkspaceData> => {
  let context;
  try {
    context = await requireWorkspace();
  } catch (error) {
    redirect(`/login?error=${encodeURIComponent(errorMessage(error))}`);
  }
  const { supabase, user, workspaceId } = context;
  const [workspace, ideas] = await Promise.all([
    supabase.from("workspaces").select("id,name").eq("id", workspaceId).single(),
    supabase.from("ideas").select("*,research_sources(*),idea_scores(*),experiments(*),idea_notes(*)")
      .eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
  ]);
  try {
    checkDatabase(workspace.error);
    checkDatabase(ideas.error);
  } catch (error) {
    redirect(`/login?error=${encodeURIComponent(errorMessage(error))}`);
  }
  return { workspace: workspace.data!, user: { id: user.id, email: user.email }, ideas: (ideas.data ?? []) as WorkspaceData["ideas"] };
});
