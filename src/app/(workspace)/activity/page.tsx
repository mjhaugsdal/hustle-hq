import Link from "next/link";
import { ArrowUpRight, Activity as ActivityIcon } from "lucide-react";
import { getWorkspaceData } from "@/lib/data";
import { dateLabel, personLabel, humanize } from "@/lib/utils";
import { criterionLabels } from "@/lib/domain";
import { Feedback, PageHeading, EmptyState, type SearchProps } from "@/components/workspace";
export default async function Activity({ searchParams }: SearchProps) {
  const [data, params] = await Promise.all([getWorkspaceData(), searchParams]);
  const events = data.ideas.flatMap((idea) => [
    { id: `idea-${idea.id}`, time: idea.updated_at, kind: "Idea updated", body: `${humanize(idea.status)} · ${idea.summary || "The opportunity is taking shape."}`, person: idea.created_by, idea },
    ...idea.idea_notes.map((n) => ({ id: n.id, time: n.created_at, kind: /decision:/i.test(n.body) ? "Decision recorded" : "Note added", body: n.body, person: n.author_id, idea })),
    ...idea.research_sources.map((s) => ({ id: s.id, time: s.created_at, kind: "Research collected", body: `${s.title} · ${humanize(s.evidence_type)} · ${s.confidence} confidence${s.finding ? `\n${s.finding}` : ""}`, person: s.created_by, idea })),
    ...idea.idea_scores.map((s) => ({ id: s.id, time: s.updated_at, kind: "Score saved", body: `${criterionLabels[s.criterion]}: ${s.score}/5${s.rationale ? `\n${s.rationale}` : ""}`, person: s.scored_by, idea })),
    ...idea.experiments.map((e) => ({ id: e.id, time: e.completed_at || e.started_at || e.created_at, kind: "Experiment", body: `${e.title} · ${humanize(e.outcome)}${e.result ? `\n${e.result}` : ""}`, person: e.created_by, idea })),
  ]).sort((a, b) => b.time.localeCompare(a.time));
  return <><Feedback params={params} /><PageHeading eyebrow="THE STORY SO FAR" title="Progress, in perspective." description="A shared record of your ideas, research, scores, experiments, notes, and decisions." /><div className="notice-panel">A timeline of current saved records, not a permanent audit log. Edits replace earlier record content and deleted records are not shown. Idea updates show the creator, not the last editor.</div>{events.length ? <div className="activity-list">{events.map((event) => <article className="activity-item" key={`${event.kind}-${event.id}`}><span className="activity-dot"><ActivityIcon size={17} /></span><div className="activity-content"><div className="record-meta">{event.kind} · {personLabel(event.person, data.user.id)} · {dateLabel(event.time)}</div><Link href={`/ideas/${event.idea.id}`} className="activity-title">{event.idea.title}<ArrowUpRight size={16} /></Link><p className="preserve-lines">{event.body}</p></div></article>)}</div> : <EmptyState title="Good things take a first step." description="Capture an idea and begin exploring. Your team’s research, experiments, and decisions will appear here." href="/discover" />}</>;
}
