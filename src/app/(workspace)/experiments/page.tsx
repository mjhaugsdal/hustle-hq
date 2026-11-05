import Link from "next/link";
import { ArrowUpRight, FlaskConical } from "lucide-react";
import { getWorkspaceData } from "@/lib/data";
import { ExperimentCard } from "@/components/forms";
import { Feedback, PageHeading, SectionHeading, EmptyState, type SearchProps } from "@/components/workspace";
export default async function Experiments({ searchParams }: SearchProps) {
  const [data, params] = await Promise.all([getWorkspaceData(), searchParams]);
  const experiments = data.ideas.flatMap((idea) => idea.experiments.map((experiment) => ({ idea, experiment }))).sort((a, b) => b.experiment.created_at.localeCompare(a.experiment.created_at));
  return <><Feedback params={params} /><PageHeading eyebrow="SMALL BETS. HONEST ANSWERS." title="Trade guesswork for learning." description="Your validation lab. Keep tests focused, success measurable, and learning visible."><Link href="/discover" className="button button-outline"><FlaskConical size={16} /> Choose an idea to test</Link></PageHeading><SectionHeading title="All experiments" count={experiments.length} description={`${experiments.filter((e) => e.experiment.outcome === "pending").length} pending · ${experiments.filter((e) => e.experiment.outcome !== "pending").length} with a recorded outcome`} />{experiments.length ? <div className="library-grid">{experiments.map(({ idea, experiment }) => <div key={experiment.id}><Link href={`/ideas/${idea.id}#experiments`} className="record-idea-link">{idea.title}<ArrowUpRight size={14} /></Link><ExperimentCard experiment={experiment} ideaId={idea.id} returnTo="/experiments" /></div>)}</div> : <EmptyState title="The smallest useful test wins." description="Plan an experiment inside an idea. Start with one hypothesis and define what success would look like." href="/discover" />}</>;
}
