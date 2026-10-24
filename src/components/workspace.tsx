import Link from "next/link";
import { ArrowUpRight, Lightbulb, Sparkles, Bookmark, ArrowRight, ShieldCheck } from "lucide-react";
import { toggleShortlist } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { evidenceConfidence, nextAction, overallScore, criteria, type Idea } from "@/lib/domain";
import { humanize } from "@/lib/utils";

export type SearchValues = Record<string, string | string[] | undefined>;
export type SearchProps = { searchParams: Promise<SearchValues> };
export function value(params: SearchValues, key: string) { const v = params[key]; return typeof v === "string" ? v : ""; }
export function Feedback({ params }: { params: SearchValues }) {
  return <>{value(params, "error") && <div role="alert" className="feedback feedback-error">{value(params, "error")}</div>}{value(params, "notice") && <div role="status" className="feedback feedback-success">{value(params, "notice")}</div>}</>;
}
export function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <header className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{children}</header>;
}
export function EmptyState({ title, description, href, label }: { title: string; description: string; href?: string; label?: string }) {
  return <div className="empty-state"><div className="empty-icon"><Lightbulb size={26} strokeWidth={1.5} /></div><h3>{title}</h3><p>{description}</p>{href && <Link href={href} className="text-link">{label || "Explore your ideas"}<ArrowRight size={16} /></Link>}</div>;
}
export function HiddenFields({ ideaId, id, returnTo }: { ideaId?: string; id?: string; returnTo: string }) {
  return <><input type="hidden" name="returnTo" value={returnTo} />{ideaId && <input type="hidden" name="idea_id" value={ideaId} />}{id && <input type="hidden" name="id" value={id} />}</>;
}
export function IdeaCard({ idea }: { idea: Idea }) {
  const score = overallScore(idea.idea_scores);
  const coverage = new Set(idea.idea_scores.map((s) => s.criterion)).size;
  return <Card className="idea-card"><div className="idea-card-top"><Badge className={`status-${idea.status}`}>{humanize(idea.status)}</Badge><form action={toggleShortlist}><HiddenFields id={idea.id} returnTo="/discover" /><SubmitButton size="icon" variant="ghost" aria-label={idea.is_shortlisted ? `Remove ${idea.title} from shortlist` : `Shortlist ${idea.title}`} title={idea.is_shortlisted ? "Remove from shortlist" : "Add to shortlist"}><Bookmark size={18} fill={idea.is_shortlisted ? "currentColor" : "none"} /></SubmitButton></form></div><div className="idea-category">{idea.category || "Uncategorized"}</div><Link href={`/ideas/${idea.id}`} className="idea-title"><h3>{idea.title}</h3><ArrowUpRight size={20} /></Link><p className="idea-summary">{idea.summary || "Every good business starts with a question. Open this idea to shape the opportunity."}</p><div className="idea-metrics"><div><span>IDEA SCORE</span><strong>{score === null ? "—" : score.toFixed(1)}<small> / 5</small></strong><small>{coverage}/{criteria.length} criteria scored</small></div><div><span>EVIDENCE</span><strong className="evidence-value">{evidenceConfidence(idea.research_sources)}</strong><small>{idea.research_sources.length} source{idea.research_sources.length === 1 ? "" : "s"} collected</small></div></div><div className="next-action"><Sparkles size={15} /><p><span>Next step</span>{nextAction(idea)}</p></div></Card>;
}
export function SectionHeading({ title, description, count }: { title: string; description?: string; count?: number }) {
  return <div className="section-heading"><div><h2>{title}{count !== undefined && <span className="count">{count}</span>}</h2>{description && <p>{description}</p>}</div></div>;
}
export function PrivacyNote() { return <span className="privacy-note"><ShieldCheck size={14} /> Private workspace · Shared with your team</span>; }
