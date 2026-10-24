import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error registerHooks is available in our Node 22 runtime, ahead of @types/node 20.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier: string, context: unknown, nextResolve: (specifier: string, context: unknown) => unknown) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

// Node's native TypeScript runner requires the extension.
const validation = await import("../src/lib/validation.ts");
const { createIdeaSchema, updateIdeaSchema, sourceSchema, scoreSchema, experimentSchema, decisionSchema, safeReturnTo } = validation;
const id = "11111111-1111-4111-8111-111111111111";

test("quick capture accepts title only and strips trusted columns", () => {
  assert.deepEqual(createIdeaSchema.parse({ title: "  A useful idea  ", workspace_id: id, created_by: id }), { title: "A useful idea" });
  assert.deepEqual(createIdeaSchema.parse({ title: "Idea", summary: "  A summary  ", category: "  Software  " }),
    { title: "Idea", summary: "A summary", category: "Software" });
  assert.equal(createIdeaSchema.safeParse({ title: "Idea", summary: "a".repeat(4001) }).success, false);
  assert.equal(createIdeaSchema.safeParse({ title: " " }).success, false);
  assert.equal(createIdeaSchema.safeParse({ title: "a".repeat(201) }).success, false);
});

test("financial fields respect database precision, range and optional blanks", () => {
  const base = { id, title: "Idea", status: "inbox" };
  for (const startup_cost of ["-1", "1.001", "10000000000", "Infinity", "NaN", "1e2", "0x10"]) {
    assert.equal(updateIdeaSchema.safeParse({ ...base, startup_cost }).success, false, startup_cost);
  }
  for (const weekly_hours of ["-1", "1.001", "168.01", "10000", "Infinity"]) {
    assert.equal(updateIdeaSchema.safeParse({ ...base, weekly_hours }).success, false, weekly_hours);
  }
  const data = updateIdeaSchema.parse({ ...base, startup_cost: "9999999999.99", weekly_hours: "168", currency_code: "usd" });
  assert.equal(data.startup_cost, 9999999999.99);
  assert.equal(data.weekly_hours, 168);
  assert.equal(data.currency_code, "USD");
  assert.equal(updateIdeaSchema.parse({ ...base, startup_cost: "" }).startup_cost, null);
  assert.equal(updateIdeaSchema.safeParse({ ...base, currency_code: "US" }).success, false);
  assert.equal(updateIdeaSchema.safeParse({ ...base, status: "invented" }).success, false);
});

test("research permits only http(s), validates dates and evidence enums", () => {
  const base = { idea_id: id, title: "Source", evidence_type: "evidence", confidence: "high" };
  for (const url of ["javascript:alert(1)", "data:text/html,hi", "ftp://example.com", "//example.com", "not a url", "https:example.com", "https://example.com/has space"]) {
    assert.equal(sourceSchema.safeParse({ ...base, url }).success, false, url);
  }
  assert.equal(sourceSchema.safeParse({ ...base, url: "https://example.com/research" }).success, true);
  assert.equal(sourceSchema.safeParse({ ...base, url: "http://example.com" }).success, true);
  assert.equal(sourceSchema.parse(base).url, null);
  assert.equal(sourceSchema.safeParse({ ...base, retrieved_at: "2026-02-30" }).success, false);
  assert.equal(sourceSchema.safeParse({ ...base, confidence: "certain" }).success, false);
});

test("scores require known criteria and integers from one to five", () => {
  const base = { idea_id: id, criterion: "demand", score: "5" };
  assert.equal(scoreSchema.parse(base).score, 5);
  for (const score of ["", "0", "6", "1.5", "NaN", "-1", true, null]) {
    assert.equal(scoreSchema.safeParse({ ...base, score }).success, false);
  }
  assert.equal(scoreSchema.safeParse({ ...base, criterion: "other" }).success, false);
});

test("experiment dates are valid and ordered; completed outcomes need results", () => {
  const base = { idea_id: id, title: "Test", hypothesis: "People will pay", outcome: "pending" };
  assert.equal(experimentSchema.safeParse(base).success, true);
  assert.equal(experimentSchema.safeParse({ ...base, started_at: "2026-02-30" }).success, false);
  assert.equal(experimentSchema.safeParse({ ...base, started_at: "2026-10-02", completed_at: "2026-10-01" }).success, false);
  assert.equal(experimentSchema.safeParse({ ...base, completed_at: "2026-10-01" }).success, false);
  assert.equal(experimentSchema.safeParse({ ...base, started_at: "2026-10-01", completed_at: "2026-10-02" }).success, false);
  for (const outcome of ["successful", "unsuccessful", "inconclusive"]) {
    assert.equal(experimentSchema.safeParse({ ...base, outcome, result: " " }).success, false);
    assert.equal(experimentSchema.safeParse({ ...base, outcome, result: "Three paid customers" }).success, false);
    assert.equal(experimentSchema.safeParse({ ...base, outcome, result: "Three paid customers", completed_at: "2026-10-02" }).success, false);
    assert.equal(experimentSchema.safeParse({ ...base, outcome, result: "Three paid customers",
      started_at: "2026-10-01", completed_at: "2026-10-02" }).success, true);
  }
});

test("decisions accept only supported transitions and require reasons", () => {
  assert.equal(decisionSchema.safeParse({ idea_id: id, decision: "pursue", reason: "Demand confirmed" }).success, true);
  assert.equal(decisionSchema.safeParse({ idea_id: id, decision: "active", reason: "Demand confirmed" }).success, false);
  assert.equal(decisionSchema.safeParse({ idea_id: id, decision: "archive", reason: " " }).success, false);
});

test("return destinations use an exact local allowlist", () => {
  assert.equal(safeReturnTo("/shortlist"), "/shortlist");
  for (const path of ["/research", "/compare", "/activity"]) assert.equal(safeReturnTo(path), path);
  assert.equal(safeReturnTo(`/ideas/${id}`), `/ideas/${id}`);
  for (const path of ["https://evil.example", "//evil.example", "/\\evil.example", "/discover?next=https://evil.example",
    "/discover/../auth/confirm", "/ideas/%2f%2fevil.example", "/login", "/discover\n", null, { path: "/archive" }]) {
    assert.equal(safeReturnTo(path), "/discover");
  }
});
