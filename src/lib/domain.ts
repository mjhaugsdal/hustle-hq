export const statuses = ["inbox", "researching", "validating", "active", "rejected", "archived"] as const;
export type IdeaStatus = (typeof statuses)[number];
export const criteria = [
  "demand", "monetization", "differentiation", "speed", "cost", "fit",
] as const;
export type Criterion = (typeof criteria)[number];
export const criterionLabels: Record<Criterion, string> = {
  demand: "Demand evidence",
  monetization: "Monetization potential",
  differentiation: "Competitive position",
  speed: "Speed to launch",
  cost: "Low startup cost",
  fit: "Lifestyle fit",
};
export const evidenceTypes = ["evidence", "assumption", "conclusion"] as const;
export const confidenceLevels = ["low", "medium", "high"] as const;
export const outcomes = ["pending", "successful", "unsuccessful", "inconclusive"] as const;
export type ResearchSource = {
  id: string; idea_id: string; title: string; url: string | null;
  source_type: string | null; finding: string | null;
  evidence_type: (typeof evidenceTypes)[number]; confidence: (typeof confidenceLevels)[number];
  created_by: string; created_at: string; retrieved_at: string | null;
};
export type IdeaScore = {
  id: string; idea_id: string; criterion: Criterion; score: number;
  rationale: string | null; scored_by: string; updated_at: string;
};
export type Experiment = {
  id: string; idea_id: string; title: string; hypothesis: string;
  method: string | null; success_metric: string | null; result: string | null;
  outcome: (typeof outcomes)[number]; started_at: string | null;
  completed_at: string | null; created_by: string; created_at: string;
};
export type IdeaNote = {
  id: string; idea_id: string; author_id: string; body: string; created_at: string;
};
export type Idea = {
  id: string; workspace_id: string; created_by: string; title: string;
  summary: string | null; problem: string | null; target_customer: string | null;
  solution: string | null; revenue_model: string | null; category: string | null;
  status: IdeaStatus; startup_cost: number | null; currency_code: string | null;
  weekly_hours: number | null; is_shortlisted: boolean;
  created_at: string; updated_at: string; archived_at: string | null;
  research_sources: ResearchSource[]; idea_scores: IdeaScore[];
  experiments: Experiment[]; idea_notes: IdeaNote[];
};
export type WorkspaceData = {
  workspace: { id: string; name: string };
  user: { id: string; email?: string };
  ideas: Idea[];
};

export function overallScore(scores: IdeaScore[]): number | null {
  if (!scores.length) return null;
  const perCriterion = criteria.flatMap((criterion) => {
    const values = scores.filter((s) => s.criterion === criterion);
    return values.length ? [values.reduce((sum, s) => sum + s.score, 0) / values.length] : [];
  });
  return perCriterion.reduce((sum, value) => sum + value, 0) / perCriterion.length;
}

export function evidenceConfidence(sources: ResearchSource[]): string {
  const evidence = sources.filter((s) => s.evidence_type === "evidence");
  if (!evidence.length) return "Unvalidated";
  const points = { low: 1, medium: 2, high: 3 };
  const average = evidence.reduce((sum, s) => sum + points[s.confidence], 0) / evidence.length;
  return average >= 2.5 ? "High" : average >= 1.5 ? "Medium" : "Low";
}

export function nextAction(idea: Idea): string {
  if (idea.status === "archived" || idea.status === "rejected") return "Review the decision before reopening";
  if (idea.status === "active") return "Review results and choose your next milestone";
  if (!idea.research_sources.some((s) => s.evidence_type === "evidence")) return "Add a source that tests your riskiest assumption";
  if (new Set(idea.idea_scores.map((s) => s.criterion)).size < criteria.length) return "Complete the scorecard with your rationale";
  if (!idea.experiments.length) return "Define a small, measurable validation experiment";
  if (idea.experiments.some((e) => e.outcome === "pending")) return "Run your experiment and record the result";
  return "Decide: pursue, investigate further, or archive";
}
