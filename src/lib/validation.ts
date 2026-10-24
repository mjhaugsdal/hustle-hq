import { z } from "zod";
import { confidenceLevels, criteria, evidenceTypes, outcomes, statuses } from "@/lib/domain";

const optionalText = (max: number) =>
  z.preprocess((value) => value == null || (typeof value === "string" && !value.trim()) ? null : value,
    z.string().trim().max(max).nullable());
const requiredText = (max: number) => z.string().trim().min(1, "This field is required.").max(max);
export const idSchema = z.uuid("Invalid record ID.");
export const ideaIdSchema = z.object({ idea_id: idSchema });
export const recordIdSchema = z.object({ id: idSchema });
export const childIdSchema = ideaIdSchema.extend({ id: idSchema });

function decimal(max: number) {
  return z.preprocess((value) => value === "" || value == null ? null : value,
    z.union([z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, "Use a nonnegative number with at most two decimal places."),
      z.number().finite().nonnegative().refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
        "Use at most two decimal places.")])
      .transform(Number).pipe(z.number().min(0).max(max)).nullable());
}

export const createIdeaSchema = z.object({
  title: requiredText(200),
  summary: optionalText(4000).optional(),
  category: optionalText(100).optional(),
});
export const updateIdeaSchema = createIdeaSchema.extend({
  id: idSchema,
  summary: optionalText(4000),
  problem: optionalText(8000),
  target_customer: optionalText(2000),
  solution: optionalText(8000),
  revenue_model: optionalText(2000),
  category: optionalText(100),
  status: z.enum(statuses),
  startup_cost: decimal(9999999999.99),
  weekly_hours: decimal(168),
  currency_code: z.preprocess((value) => value === "" || value == null ? null : value,
    z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a three-letter currency code.").nullable()),
}).superRefine((value, ctx) => {
  if (value.startup_cost !== null && !value.currency_code) {
    ctx.addIssue({ code: "custom", path: ["currency_code"], message: "Choose a currency when entering a startup cost." });
  }
});

const optionalUrl = z.preprocess((value) => value === "" || value == null ? null : value,
  z.url({ protocol: /^https?$/, error: "Use a complete http:// or https:// URL." }).max(2048)
    .refine((value) => /^https?:\/\/[^/]/i.test(value) && !/\s/.test(value),
      "Use a complete URL without spaces.").nullable());
const optionalDate = z.preprocess((value) => value === "" || value == null ? null : value,
  z.iso.date({ error: "Use a valid date (YYYY-MM-DD)." }).nullable());
export const sourceSchema = ideaIdSchema.extend({
  title: requiredText(200),
  url: optionalUrl,
  source_type: optionalText(100),
  finding: optionalText(8000),
  evidence_type: z.enum(evidenceTypes),
  confidence: z.enum(confidenceLevels),
  retrieved_at: optionalDate,
});
export const updateSourceSchema = sourceSchema.extend({ id: idSchema });
export const scoreSchema = ideaIdSchema.extend({
  criterion: z.enum(criteria),
  score: z.preprocess((value) => typeof value === "string" && /^[1-5]$/.test(value) ? Number(value) : value,
    z.number().int().min(1).max(5)),
  rationale: optionalText(4000),
});
const experimentFields = ideaIdSchema.extend({
  title: requiredText(200),
  hypothesis: requiredText(4000),
  method: optionalText(8000),
  success_metric: optionalText(2000),
  result: optionalText(8000),
  outcome: z.enum(outcomes),
  started_at: optionalDate,
  completed_at: optionalDate,
});
function checkExperiment(value: z.infer<typeof experimentFields>, ctx: z.RefinementCtx) {
  if (value.started_at && value.completed_at && value.completed_at < value.started_at) {
    ctx.addIssue({ code: "custom", path: ["completed_at"], message: "Completion cannot be before the start date." });
  }
  if (value.outcome !== "pending" && !value.result?.trim()) {
    ctx.addIssue({ code: "custom", path: ["result"], message: "Record a result for a completed experiment." });
  }
}
export const experimentSchema = experimentFields.superRefine(checkExperiment);
export const updateExperimentSchema = experimentFields.extend({ id: idSchema }).superRefine(checkExperiment);
export const noteSchema = ideaIdSchema.extend({ body: requiredText(10000) });
export const decisionSchema = ideaIdSchema.extend({
  decision: z.enum(["pursue", "investigate", "archive"]),
  reason: requiredText(5000),
});
export const signInSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1, "Enter your password.").max(1024),
});

export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 500 || /[\\\u0000-\u0020%?#]/.test(value)) return "/discover";
  if (["/discover", "/research", "/compare", "/activity", "/shortlist", "/experiments", "/decisions", "/archive", "/dashboard", "/settings", "/ideas"].includes(value)) return value;
  if (/^\/ideas\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value;
  return "/discover";
}
