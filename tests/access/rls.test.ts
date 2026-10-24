import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);
const skip = configured ? false :
  "Local integration environment missing: SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SERVICE_ROLE_KEY";

type Row = Record<string, unknown>;
type Reply = { status: number; body: unknown };
const tables = ["workspaces", "workspace_members", "ideas", "research_sources", "idea_scores", "experiments", "idea_notes"] as const;
const children = ["research_sources", "idea_scores", "experiments", "idea_notes"] as const;

test("Supabase access control and integrity (local integration)", { skip }, async (t) => {
  // Never let a copied production service credential turn this suite into a destructive test.
  const endpoint = new URL(url!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname),
    "Access tests only permit a loopback Supabase URL");
  assert.ok(["http:", "https:"].includes(endpoint.protocol));
  assert.equal(endpoint.username, "");
  assert.equal(endpoint.password, "");
  assert.equal(endpoint.pathname, "/");
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient(url!, serviceKey!, options);
  const users: { id: string; token: string }[] = [];
  const workspaceIds: string[] = [];
  const runId = randomUUID();

  async function rest(token: string | null, table: string, method = "GET", body?: Row, query = ""): Promise<Reply> {
    const response = await fetch(`${url}/rest/v1/${table}${query}`, {
      method,
      headers: {
        apikey: anonKey!,
        Authorization: ["Bearer", token ?? anonKey].join(" "),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }
  function success(reply: Reply): Row[] {
    assert.ok(reply.status >= 200 && reply.status < 300, JSON.stringify(reply));
    assert.ok(Array.isArray(reply.body), JSON.stringify(reply));
    return reply.body as Row[];
  }
  function denied(reply: Reply) {
    assert.ok(reply.status >= 400 || (Array.isArray(reply.body) && reply.body.length === 0), JSON.stringify(reply));
  }
  function rejected(reply: Reply) {
    assert.ok(reply.status >= 400, JSON.stringify(reply));
  }
  async function adminRow(table: string, id: string) {
    const result = await admin.from(table).select("*").eq("id", id).single();
    assert.ifError(result.error);
    return result.data as Row;
  }

  try {
    for (let index = 0; index < 3; index++) {
      const email = `access-${runId}-${index}@example.test`;
      const password = `Test-${randomUUID()}-Aa9!`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.ifError(created.error);
      const id = created.data.user!.id;
      users.push({ id, token: "" });
      const client = createClient(url!, anonKey!, options);
      const signed = await client.auth.signInWithPassword({ email, password });
      assert.ifError(signed.error);
      users[index].token = signed.data.session!.access_token;
    }
    const [member, colleague, outsider] = users;
    for (let index = 0; index < 2; index++) {
      const id = randomUUID();
      workspaceIds.push(id);
      const inserted = await admin.from("workspaces").insert({ id, name: `Access ${runId} ${index}` });
      assert.ifError(inserted.error);
    }
    const [workspace, otherWorkspace] = workspaceIds;
    const memberships = await admin.from("workspace_members").insert([
      { workspace_id: workspace, user_id: member.id, role: "owner" },
      { workspace_id: workspace, user_id: colleague.id, role: "member" },
      { workspace_id: otherWorkspace, user_id: member.id, role: "member" },
      { workspace_id: otherWorkspace, user_id: outsider.id, role: "member" },
    ]);
    assert.ifError(memberships.error);
    const idea = success(await rest(member.token, "ideas", "POST", {
      workspace_id: workspace, title: "Member idea", created_by: member.id,
      created_at: "2000-01-01T00:00:00Z", updated_at: "2000-01-01T00:00:00Z",
    }))[0];
    const otherIdea = success(await rest(member.token, "ideas", "POST", {
      workspace_id: otherWorkspace, title: "Other idea",
    }))[0];
    const ideaId = idea.id as string;
    const otherIdeaId = otherIdea.id as string;
    const payloads: Record<string, Row> = {
      research_sources: { idea_id: ideaId, title: "Evidence", url: "https://example.test/research" },
      idea_scores: { idea_id: ideaId, criterion: "demand", score: 3 },
      experiments: { idea_id: ideaId, title: "Interview", hypothesis: "People need this" },
      idea_notes: { idea_id: ideaId, body: "Initial note" },
    };
    const rows: Record<string, Row> = { ideas: idea };
    for (const table of children) {
      rows[table] = success(await rest(member.token, table, "POST", payloads[table]))[0];
    }
    const keys: Record<string, string> = {
      workspaces: `?id=eq.${workspace}`,
      workspace_members: `?workspace_id=eq.${workspace}`,
      ...Object.fromEntries(Object.entries(rows).map(([table, row]) => [table, `?id=eq.${row.id}`])),
    };

    await t.test("every table is member-readable and hidden from outsiders and anonymous JWTs", async () => {
      for (const table of tables) {
        assert.ok(success(await rest(colleague.token, table, "GET", undefined, keys[table])).length > 0, table);
        denied(await rest(outsider.token, table, "GET", undefined, keys[table]));
        denied(await rest(null, table, "GET", undefined, keys[table]));
      }
      const nested = success(await rest(member.token, "ideas", "GET", undefined,
        `?id=eq.${ideaId}&select=*,research_sources(*),idea_scores(*),experiments(*),idea_notes(*)`))[0];
      for (const table of children) {
        assert.equal((nested[table] as Row[]).length, 1, `nested ${table}`);
      }
      const resolved = success(await rest(colleague.token, "workspace_members", "GET", undefined,
        `?user_id=eq.${colleague.id}&select=workspace_id,workspaces(id,name)`));
      assert.equal(resolved.length, 1);
      assert.equal((resolved[0].workspaces as Row).id, workspace);
    });

    await t.test("workspaces and memberships cannot be mutated by any untrusted client", async () => {
      for (const token of [member.token, colleague.token, outsider.token, null]) {
        for (const table of ["workspaces", "workspace_members"]) {
          const payload = table === "workspaces" ? { name: "Unauthorized" } :
            { workspace_id: workspace, user_id: outsider.id, role: "owner" };
          rejected(await rest(token, table, "POST", payload));
          rejected(await rest(token, table, "PATCH",
            table === "workspaces" ? { name: "Hijacked" } : { role: "owner" }, keys[table]));
          rejected(await rest(token, table, "DELETE", undefined, keys[table]));
        }
        rejected(await rest(token, "workspace_members", "PATCH",
          { workspace_id: otherWorkspace, user_id: outsider.id }, keys.workspace_members));
      }
      assert.equal((await adminRow("workspaces", workspace)).name, `Access ${runId} 0`);
    });

    await t.test("outsiders and anonymous clients cannot insert, change, or delete any idea data", async () => {
      for (const token of [outsider.token, null]) {
        for (const table of ["ideas", ...children]) {
          const payload = table === "ideas" ? { workspace_id: workspace, title: "Intrusion" } : payloads[table];
          rejected(await rest(token, table, "POST", payload));
          const changes = table === "idea_scores" ? { score: 1 } :
            table === "idea_notes" ? { body: "Intrusion" } : { title: "Intrusion" };
          denied(await rest(token, table, "PATCH", changes, keys[table]));
          denied(await rest(token, table, "DELETE", undefined, keys[table]));
          assert.ok(await adminRow(table, rows[table].id as string));
        }
      }
    });

    await t.test("creator identity, parent, workspace, ID, and creation time are immutable", async () => {
      const actorFields: Record<string, string> = {
        ideas: "created_by", research_sources: "created_by", idea_scores: "scored_by",
        experiments: "created_by", idea_notes: "author_id",
      };
      for (const table of ["ideas", ...children]) {
        const payload = table === "ideas" ? { workspace_id: workspace, title: "Spoof" } : payloads[table];
        rejected(await rest(member.token, table, "POST", { ...payload, [actorFields[table]]: outsider.id }));
        rejected(await rest(member.token, table, "PATCH", { [actorFields[table]]: colleague.id }, keys[table]));
        rejected(await rest(member.token, table, "PATCH", { id: randomUUID() }, keys[table]));
        if (table !== "idea_scores") {
          rejected(await rest(member.token, table, "PATCH", { created_at: "2000-01-01T00:00:00Z" }, keys[table]));
        }
        const parentField = table === "ideas" ? "workspace_id" : "idea_id";
        rejected(await rest(member.token, table, "PATCH",
          { [parentField]: table === "ideas" ? otherWorkspace : otherIdeaId }, keys[table]));
        assert.equal((await adminRow(table, rows[table].id as string))[actorFields[table]], member.id);
      }
      rejected(await rest(member.token, "idea_scores", "PATCH", { criterion: "fit" }, keys.idea_scores));
    });

    await t.test("members collaborate on non-score records without changing authorship", async () => {
      for (const table of ["ideas", "research_sources", "experiments", "idea_notes"]) {
        const changes = table === "idea_notes" ? { body: "Collaborative edit" } : { title: "Collaborative edit" };
        assert.equal(success(await rest(colleague.token, table, "PATCH", changes, keys[table])).length, 1);
      }
      assert.equal((await adminRow("idea_notes", rows.idea_notes.id as string)).author_id, member.id);
    });

    await t.test("scores are independent per scorer, visible to all members, writable only by scorer", async () => {
      const ownScore = success(await rest(colleague.token, "idea_scores", "POST", {
        idea_id: ideaId, criterion: "demand", score: 5,
      }))[0];
      const colleagueKey = `?id=eq.${ownScore.id}`;
      rejected(await rest(colleague.token, "idea_scores", "POST", {
        idea_id: ideaId, criterion: "demand", score: 4,
      }));
      const visible = success(await rest(colleague.token, "idea_scores", "GET", undefined, `?idea_id=eq.${ideaId}`));
      assert.equal(visible.length, 2);
      denied(await rest(colleague.token, "idea_scores", "PATCH", { score: 1 }, keys.idea_scores));
      denied(await rest(colleague.token, "idea_scores", "DELETE", undefined, keys.idea_scores));
      denied(await rest(member.token, "idea_scores", "PATCH", { score: 1 }, colleagueKey));
      assert.equal((await adminRow("idea_scores", rows.idea_scores.id as string)).score, 3);
      const updated = success(await rest(colleague.token, "idea_scores", "PATCH",
        { score: 4, updated_at: "2000-01-01T00:00:00Z" }, colleagueKey))[0];
      assert.equal(updated.score, 4);
      assert.notEqual(updated.updated_at, "2000-01-01T00:00:00+00:00");
      assert.equal(success(await rest(colleague.token, "idea_scores", "DELETE", undefined, colleagueKey)).length, 1);
    });

    await t.test("database constraints reject invalid enums, bounds, URLs, currency, and experiment dates", async () => {
      const invalid: [string, Row][] = [
        ["ideas", { title: " " }], ["ideas", { title: "x".repeat(201) }],
        ["ideas", { status: "pursue" }], ["ideas", { startup_cost: -1, currency_code: "USD" }],
        ["ideas", { startup_cost: 1, currency_code: null }], ["ideas", { currency_code: "usd" }],
        ["ideas", { currency_code: "US" }], ["ideas", { weekly_hours: -1 }],
        ["ideas", { weekly_hours: 10000 }],
        ["ideas", { startup_cost: 10000000000, currency_code: "USD" }],
        ["ideas", { is_shortlisted: null }],
        ["research_sources", { url: "javascript:alert(1)" }],
        ["research_sources", { url: "ftp://example.test" }],
        ["research_sources", { url: "https://example.test/white space" }],
        ["research_sources", { evidence_type: "fact" }], ["research_sources", { confidence: "certain" }],
        ["idea_scores", { criterion: "invalid" }], ["idea_scores", { score: 0 }],
        ["idea_scores", { score: 6 }], ["idea_scores", { score: 1.5 }],
        ["experiments", { outcome: "passed" }],
        ["experiments", { hypothesis: " " }],
        ["experiments", { completed_at: "2026-01-01T00:00:00Z" }],
        ["experiments", { outcome: "successful", started_at: "2026-02-01T00:00:00Z", completed_at: "2026-01-01T00:00:00Z", result: "Yes" }],
        ["experiments", { outcome: "successful", started_at: "2026-01-01T00:00:00Z", completed_at: "2026-02-01T00:00:00Z", result: " " }],
        ["idea_notes", { body: " " }], ["idea_notes", { body: "x".repeat(10001) }],
      ];
      for (const [table, changes] of invalid) {
        const payload = table === "ideas" ? { workspace_id: workspace, title: "Invalid" } :
          { ...payloads[table], ...(table === "idea_scores" ? { criterion: "fit" } : {}) };
        rejected(await rest(member.token, table, "POST", { ...payload, ...changes }));
      }
      const limits = success(await rest(member.token, "ideas", "PATCH", {
        startup_cost: 9999999999.99, currency_code: "USD", weekly_hours: 9999.99,
      }, keys.ideas))[0];
      assert.equal(limits.startup_cost, 9999999999.99);
      assert.equal(limits.weekly_hours, 9999.99);
      const undated = success(await rest(member.token, "experiments", "PATCH", {
        outcome: "successful", result: "Five customers signed up",
      }, keys.experiments))[0];
      assert.equal(undated.started_at, null);
      assert.equal(undated.completed_at, null);
      const valid = success(await rest(member.token, "experiments", "PATCH", {
        outcome: "successful", started_at: "2026-01-01T00:00:00Z",
        completed_at: "2026-01-02T00:00:00Z", result: "Five customers signed up",
      }, keys.experiments))[0];
      assert.equal(valid.outcome, "successful");
    });

    await t.test("archive and update timestamps are server-maintained", async () => {
      assert.ok(Date.parse(idea.created_at as string) > Date.parse("2026-01-01"));
      assert.ok(Date.parse(idea.updated_at as string) > Date.parse("2026-01-01"));
      let changed = success(await rest(member.token, "ideas", "PATCH", {
        status: "archived", archived_at: "2000-01-01T00:00:00Z", updated_at: "2000-01-01T00:00:00Z",
        is_shortlisted: true, startup_cost: 0, currency_code: "USD", weekly_hours: 0,
      }, keys.ideas))[0];
      assert.ok(changed.archived_at);
      assert.ok(Date.parse(changed.archived_at as string) > Date.parse("2026-01-01"));
      assert.ok(Date.parse(changed.updated_at as string) > Date.parse("2026-01-01"));
      const archivedAt = changed.archived_at;
      changed = success(await rest(member.token, "ideas", "PATCH", {
        archived_at: "2000-01-01T00:00:00Z",
      }, keys.ideas))[0];
      assert.equal(changed.archived_at, archivedAt);
      changed = success(await rest(member.token, "ideas", "PATCH", { status: "researching" }, keys.ideas))[0];
      assert.equal(changed.archived_at, null);
      assert.equal(changed.is_shortlisted, true);
    });

    await t.test("decision RPC requires membership, validates input, and writes status plus attributed note", async () => {
      async function decide(token: string | null, decision: unknown, reason: unknown, id = ideaId) {
        return rest(token, "rpc/record_decision", "POST", {
          p_idea_id: id, p_decision: decision, p_reason: reason,
        });
      }
      for (const token of [outsider.token, null]) {
        rejected(await decide(token, "archive", "Unauthorized"));
      }
      rejected(await decide(member.token, "pursue", "Missing idea", randomUUID()));
      const beforeNotes = success(await rest(member.token, "idea_notes", "GET", undefined, `?idea_id=eq.${ideaId}`)).length;
      for (const [decision, reason] of [
        ["delete", "No"], [null, "No"], ["archive", ""], ["archive", " "],
        ["archive", null], ["archive", "x".repeat(5001)],
      ]) {
        rejected(await decide(member.token, decision, reason));
      }
      assert.equal((await adminRow("ideas", ideaId)).status, "researching");
      assert.equal(success(await rest(member.token, "idea_notes", "GET", undefined, `?idea_id=eq.${ideaId}`)).length, beforeNotes);
      for (const [decision, status] of [["pursue", "active"], ["archive", "archived"], ["investigate", "researching"]]) {
        const reply = await decide(colleague.token, decision, `Reason to ${decision}`);
        assert.ok(reply.status >= 200 && reply.status < 300, JSON.stringify(reply));
        const current = await adminRow("ideas", ideaId);
        assert.equal(current.status, status);
        assert.equal(current.archived_at !== null, status === "archived");
        const notes = success(await rest(member.token, "idea_notes", "GET", undefined,
          `?idea_id=eq.${ideaId}&author_id=eq.${colleague.id}`));
        assert.ok(notes.some((note) => note.body === `Decision: ${decision}\nReason to ${decision}`));
      }
      assert.equal(success(await rest(member.token, "idea_notes", "GET", undefined, `?idea_id=eq.${ideaId}`)).length, beforeNotes + 3);
    });

    await t.test("members can delete collaborative children; deleting an idea cascades all children", async () => {
      for (const table of ["research_sources", "experiments", "idea_notes"]) {
        const disposable = success(await rest(member.token, table, "POST", payloads[table]))[0];
        assert.equal(success(await rest(colleague.token, table, "DELETE", undefined, `?id=eq.${disposable.id}`)).length, 1);
      }
      assert.equal(success(await rest(colleague.token, "ideas", "DELETE", undefined, keys.ideas)).length, 1);
      for (const table of children) {
        const remaining = await admin.from(table).select("id").eq("idea_id", ideaId);
        assert.ifError(remaining.error);
        assert.equal(remaining.data!.length, 0, table);
      }
    });
  } finally {
    // Clear referencing data before deleting auth users (provenance FKs are RESTRICT).
    const cleanupErrors: unknown[] = [];
    for (const workspaceId of workspaceIds) {
      const removed = await admin.from("workspaces").delete().eq("id", workspaceId);
      if (removed.error) cleanupErrors.push(removed.error);
    }
    for (const user of users) {
      const removed = await admin.auth.admin.deleteUser(user.id);
      if (removed.error) cleanupErrors.push(removed.error);
    }
    assert.deepEqual(cleanupErrors, [], "All test workspaces and users must be cleaned up");
  }
});
