import { ZodError } from "zod";

export class PublicError extends Error {}

export function errorMessage(error: unknown): string {
  if (error instanceof PublicError) return error.message;
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return `${issue.path.join(" ") || "Form"}: ${issue.message}`;
  }
  return "We could not save this change. Check your connection and workspace access, then try again.";
}

export function checkDatabase(error: { code?: string } | null): void {
  if (!error) return;
  if (error.code === "23505") throw new PublicError("This record already exists. Refresh and try again.");
  if (error.code === "42501") throw new PublicError("You do not have permission to change this record.");
  throw new PublicError("The database request failed. Check that the Supabase migrations are installed and your workspace access is active.");
}
