"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  childIdSchema, createIdeaSchema, decisionSchema, experimentSchema,
  noteSchema, recordIdSchema, safeReturnTo, scoreSchema, signInSchema, sourceSchema,
  updateExperimentSchema, updateIdeaSchema, updateSourceSchema,
} from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";
import { checkDatabase, errorMessage, PublicError } from "@/lib/supabase/errors";
import { requireIdea, requireWorkspace, resolveWorkspace, type WorkspaceContext } from "@/lib/supabase/workspace";

function destination(path: string, key: "notice" | "error", message: string) {
  return `${path}?${key}=${encodeURIComponent(message)}`;
}

async function mutate<T>(
  form: FormData,
  schema: z.ZodType<T>,
  operation: (context: WorkspaceContext, input: T) => Promise<void>,
  notice: string,
): Promise<void> {
  const returnTo = safeReturnTo(form.get("returnTo"));
  let failure: string | undefined;
  try {
    const input = schema.parse(Object.fromEntries(form));
    const context = await requireWorkspace();
    await operation(context, input);
  } catch (error) {
    failure = errorMessage(error);
  }
  if (failure) redirect(destination(returnTo, "error", failure));
  revalidatePath("/", "layout");
  redirect(destination(returnTo, "notice", notice));
}

function changed(result: { error: { code?: string } | null; data: unknown }) {
  checkDatabase(result.error);
  if (!result.data || (Array.isArray(result.data) && result.data.length === 0)) {
    throw new PublicError("No record was changed. It may have been removed or you no longer have access.");
  }
}

export async function signIn(form: FormData): Promise<void> {
  let failure: string | undefined;
  try {
    const input = signInSchema.parse(Object.fromEntries(form));
    const supabase = await createClient();
    const result = await supabase.auth.signInWithPassword(input);
    if (result.error) {
      throw new PublicError(result.error.code === "email_not_confirmed"
        ? "Confirm your invitation email before signing in."
        : "Unable to sign in. Check your email and password, and make sure you have been invited.");
    }
    await resolveWorkspace();
  } catch (error) {
    failure = errorMessage(error);
  }
  if (failure) redirect(destination("/login", "error", failure));
  revalidatePath("/", "layout");
  redirect(safeReturnTo(form.get("returnTo")));
}

export async function signOut(_form: FormData): Promise<void> {
  void _form;
  let failure: string | undefined;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw new PublicError("Unable to sign out. Please try again.");
  } catch (error) {
    failure = errorMessage(error);
  }
  revalidatePath("/", "layout");
  redirect(destination("/login", failure ? "error" : "notice", failure ?? "You have been signed out."));
}

export async function createIdea(form: FormData): Promise<void> {
  return mutate(form, createIdeaSchema, async ({ supabase, workspaceId, user }, input) => {
    changed(await supabase.from("ideas").insert({
      ...input, workspace_id: workspaceId, created_by: user.id, status: "inbox",
    }).select("id").single());
  }, "Idea captured.");
}

export async function updateIdea(form: FormData): Promise<void> {
  return mutate(form, updateIdeaSchema, async (context, { id, ...input }) => {
    await requireIdea(context, id);
    changed(await context.supabase.from("ideas").update({
      ...input, archived_at: input.status === "archived" ? new Date().toISOString() : null,
    }).eq("id", id).eq("workspace_id", context.workspaceId).select("id").maybeSingle());
  }, "Idea updated.");
}

export async function archiveIdea(form: FormData): Promise<void> {
  return mutate(form, recordIdSchema, async (context, { id }) => {
    await requireIdea(context, id);
    changed(await context.supabase.from("ideas").update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", id).eq("workspace_id", context.workspaceId).select("id").maybeSingle());
  }, "Idea archived.");
}

export async function toggleShortlist(form: FormData): Promise<void> {
  return mutate(form, recordIdSchema, async (context, { id }) => {
    const idea = await requireIdea(context, id);
    changed(await context.supabase.from("ideas").update({ is_shortlisted: !idea.is_shortlisted })
      .eq("id", id).eq("workspace_id", context.workspaceId)
      .eq("is_shortlisted", idea.is_shortlisted).select("id").maybeSingle());
  }, "Shortlist updated.");
}

export async function addSource(form: FormData): Promise<void> {
  return mutate(form, sourceSchema, async (context, input) => {
    await requireIdea(context, input.idea_id);
    changed(await context.supabase.from("research_sources").insert({ ...input, created_by: context.user.id })
      .select("id").single());
  }, "Research source added.");
}

export async function updateSource(form: FormData): Promise<void> {
  return mutate(form, updateSourceSchema, async (context, { id, idea_id, ...input }) => {
    await requireIdea(context, idea_id);
    changed(await context.supabase.from("research_sources").update(input)
      .eq("id", id).eq("idea_id", idea_id).select("id").maybeSingle());
  }, "Research source updated.");
}

async function deleteChild(form: FormData, table: "research_sources" | "experiments" | "idea_notes", notice: string) {
  return mutate(form, childIdSchema, async (context, { id, idea_id }) => {
    await requireIdea(context, idea_id);
    changed(await context.supabase.from(table).delete().eq("id", id).eq("idea_id", idea_id).select("id").maybeSingle());
  }, notice);
}

export async function deleteSource(form: FormData): Promise<void> {
  return deleteChild(form, "research_sources", "Research source removed.");
}

export async function saveScore(form: FormData): Promise<void> {
  return mutate(form, scoreSchema, async (context, input) => {
    await requireIdea(context, input.idea_id);
    changed(await context.supabase.from("idea_scores").upsert({
      ...input, scored_by: context.user.id, updated_at: new Date().toISOString(),
    }, { onConflict: "idea_id,criterion,scored_by" }).select("id").single());
  }, "Score saved.");
}

export async function createExperiment(form: FormData): Promise<void> {
  return mutate(form, experimentSchema, async (context, input) => {
    await requireIdea(context, input.idea_id);
    changed(await context.supabase.from("experiments").insert({ ...input, created_by: context.user.id })
      .select("id").single());
  }, "Experiment created.");
}

export async function updateExperiment(form: FormData): Promise<void> {
  return mutate(form, updateExperimentSchema, async (context, { id, idea_id, ...input }) => {
    await requireIdea(context, idea_id);
    changed(await context.supabase.from("experiments").update(input)
      .eq("id", id).eq("idea_id", idea_id).select("id").maybeSingle());
  }, "Experiment updated.");
}

export async function deleteExperiment(form: FormData): Promise<void> {
  return deleteChild(form, "experiments", "Experiment removed.");
}

export async function addNote(form: FormData): Promise<void> {
  return mutate(form, noteSchema, async (context, input) => {
    await requireIdea(context, input.idea_id);
    changed(await context.supabase.from("idea_notes").insert({ ...input, author_id: context.user.id })
      .select("id").single());
  }, "Note added.");
}

export async function deleteNote(form: FormData): Promise<void> {
  return deleteChild(form, "idea_notes", "Note removed.");
}

export async function recordDecision(form: FormData): Promise<void> {
  return mutate(form, decisionSchema, async (context, input) => {
    await requireIdea(context, input.idea_id);
    const result = await context.supabase.rpc("record_decision", {
      p_idea_id: input.idea_id, p_decision: input.decision, p_reason: input.reason,
    });
    // The transactional RPC raises on an inaccessible or zero-row idea update.
    checkDatabase(result.error);
  }, "Decision recorded.");
}
