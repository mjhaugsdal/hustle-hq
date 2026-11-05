import Link from "next/link";
import { Bookmark, ArrowUpRight } from "lucide-react";
import { getWorkspaceData } from "@/lib/data";
import { criteria, criterionLabels, overallScore, evidenceConfidence } from "@/lib/domain";
import { personLabel } from "@/lib/utils";
import { Feedback, PageHeading, EmptyState, type SearchProps } from "@/components/workspace";
import { Badge } from "@/components/ui/badge";
export default async function Compare({ searchParams }: SearchProps) {
  const [data, params] = await Promise.all([getWorkspaceData(), searchParams]);
  const ideas = data.ideas.filter((i) => i.is_shortlisted);
  return <><Feedback params={params} /><PageHeading eyebrow="CLARITY OVER HYPE" title="Give the good ones a fair look." description="Compare your shortlist side by side. Keep independent judgment and evidence in view."><Link href="/discover?status=shortlisted" className="button button-outline"><Bookmark size={16} /> Manage shortlist</Link></PageHeading><div className="notice-panel">Scores are directional, not predictions. Each criterion averages submitted member scores; the overall averages only scored criteria. A partial score is not a complete assessment. Evidence confidence remains separate.</div>{ideas.length ? <div className="comparison-scroll" tabIndex={0} role="region" aria-label="Side-by-side idea comparison"><div className="comparison-grid" style={{ gridTemplateColumns: `repeat(${ideas.length}, minmax(290px, 1fr))` }}>{ideas.map((idea) => {
    const score = overallScore(idea.idea_scores), people = [...new Set(idea.idea_scores.map((s) => s.scored_by))];
    return <article className="comparison-card" key={idea.id}><header><Badge>{idea.category || "Uncategorized"}</Badge><Link href={`/ideas/${idea.id}`}><h2>{idea.title}</h2><ArrowUpRight size={18} /></Link><p>{idea.summary || "No summary yet."}</p></header><div className="compare-overall"><span>Overall idea score</span><strong>{score === null ? "—" : `${score.toFixed(1)} / 5`}</strong><small>{new Set(idea.idea_scores.map((s) => s.criterion)).size}/6 criteria · {people.length} contributor{people.length === 1 ? "" : "s"}</small></div><div className="compare-evidence"><span>Evidence confidence</span><strong>{evidenceConfidence(idea.research_sources)}</strong><small>{idea.research_sources.filter((s) => s.evidence_type === "evidence").length} evidence sources · {idea.research_sources.filter((s) => s.evidence_type === "assumption").length} assumptions</small></div>{criteria.map((criterion) => {
      const entries = idea.idea_scores.filter((s) => s.criterion === criterion);
      return <div className="compare-criterion" key={criterion}><h3>{criterionLabels[criterion]}<span>{entries.length ? `${(entries.reduce((a, e) => a + e.score, 0) / entries.length).toFixed(1)}/5` : "—"}</span></h3>{entries.length ? entries.map((entry) => <div className="person-score" key={entry.id}><strong>{personLabel(entry.scored_by, data.user.id)} · {entry.score}/5</strong><p>{entry.rationale || "No rationale recorded."}</p></div>) : <p className="muted">Not scored yet.</p>}</div>;
    })}<Link className="text-link" href={`/ideas/${idea.id}#scoring`}>Open scorecards <ArrowUpRight size={14} /></Link></article>;
  })}</div></div> : <EmptyState title="Make a little room for the standouts." description="Bookmark ideas in Discover to add them to your shortlist. Then compare the evidence and independent scorecards here." href="/discover" label="Find your contenders" />}</>;
}
