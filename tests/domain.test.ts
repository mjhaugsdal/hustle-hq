import assert from "node:assert/strict";
import test from "node:test";
import {
  criteria, evidenceConfidence, nextAction, overallScore,
  type Idea, type IdeaScore, type ResearchSource,
} from "../src/lib/domain.ts";

function score(criterion: IdeaScore["criterion"], value: number, person = "one"): IdeaScore {
  return { id: `${criterion}-${person}`, idea_id: "idea", criterion, score: value,
    rationale: null, scored_by: person, updated_at: "2026-01-01T00:00:00Z" };
}
function source(type: ResearchSource["evidence_type"], confidence: ResearchSource["confidence"]): ResearchSource {
  return { id: "source", idea_id: "idea", title: "Interview", url: null,
    source_type: "interview", finding: null, evidence_type: type, confidence,
    created_by: "one", created_at: "2026-01-01T00:00:00Z", retrieved_at: null };
}
function idea(overrides: Partial<Idea> = {}): Idea {
  return { id: "idea", workspace_id: "workspace", created_by: "one", title: "Test",
    summary: null, problem: null, target_customer: null, solution: null,
    revenue_model: null, category: null, status: "inbox", startup_cost: null,
    currency_code: null, weekly_hours: null, is_shortlisted: false,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    archived_at: null, research_sources: [], idea_scores: [], experiments: [],
    idea_notes: [], ...overrides };
}

test("an unscored idea has no overall score, not zero", () => {
  assert.equal(overallScore([]), null);
});

test("criteria are equally weighted even when people score different subsets", () => {
  assert.equal(overallScore([score("demand", 5), score("demand", 3, "two"), score("fit", 2)]), 3);
});

test("high scores and high-confidence assumptions cannot imply validated evidence", () => {
  assert.equal(overallScore(criteria.map((criterion) => score(criterion, 5))), 5);
  assert.equal(evidenceConfidence([source("assumption", "high"), source("conclusion", "high")]), "Unvalidated");
});

test("only actual evidence contributes to evidence confidence", () => {
  assert.equal(evidenceConfidence([source("evidence", "low"), source("assumption", "high")]), "Low");
  assert.equal(evidenceConfidence([source("evidence", "low"), source("evidence", "high")]), "Medium");
  assert.equal(evidenceConfidence([source("evidence", "high")]), "High");
});

test("recommended actions follow the evidence, scoring, experiment, decision workflow", () => {
  assert.match(nextAction(idea()), /source/);
  const researched = idea({ research_sources: [source("evidence", "medium")] });
  assert.match(nextAction(researched), /scorecard/);
  const scored = { ...researched, idea_scores: criteria.map((criterion) => score(criterion, 3)) };
  assert.match(nextAction(scored), /experiment/);
  const experiment = { id: "experiment", idea_id: "idea", title: "Interviews",
    hypothesis: "Customers need this", method: null, success_metric: "3 commitments",
    result: null, outcome: "pending" as const, started_at: null, completed_at: null,
    created_by: "one", created_at: "2026-01-01T00:00:00Z" };
  assert.match(nextAction({ ...scored, experiments: [experiment] }), /record the result/);
  assert.match(nextAction({ ...scored, experiments: [{ ...experiment, outcome: "successful" }] }), /Decide/);
});

test("archived and rejected ideas recommend review rather than new work", () => {
  assert.match(nextAction(idea({ status: "archived" })), /decision/);
  assert.match(nextAction(idea({ status: "rejected" })), /decision/);
});
