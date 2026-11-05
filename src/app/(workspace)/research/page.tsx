import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { getWorkspaceData } from "@/lib/data";
import { Feedback, PageHeading, EmptyState, SectionHeading, type SearchProps } from "@/components/workspace";
import { SourceCard } from "@/components/forms";

export default async function Research({ searchParams }: SearchProps) {
  const [data, params] = await Promise.all([getWorkspaceData(), searchParams]);
  const sources = data.ideas
    .flatMap((idea) => idea.research_sources.map((source) => ({ idea, source })))
    .sort((a, b) => b.source.created_at.localeCompare(a.source.created_at));

  return (
    <>
      <Feedback params={params} />
      <PageHeading eyebrow="FOLLOW THE EVIDENCE" title="Curiosity, with receipts." description="One shared library of what you know, what you assume, and what’s still a question.">
        <Link href="/discover" className="button button-outline"><BookOpen size={16} /> Explore ideas</Link>
      </PageHeading>
      <div className="notice-panel">A source is not automatically proof. Label assumptions honestly, record retrieval dates, and assess confidence in the finding — not the idea.</div>
      <SectionHeading title="Your research library" count={sources.length} description="Sources across every idea, including archived opportunities." />
      {sources.length
        ? <div className="library-grid">{sources.map(({ idea, source }) => (
          <div key={source.id}>
            <Link href={`/ideas/${idea.id}#research`} className="record-idea-link">{idea.title}<ArrowUpRight size={14} /></Link>
            <SourceCard source={source} ideaId={idea.id} returnTo="/research" userId={data.user.id} />
          </div>
        ))}</div>
        : <EmptyState title="Good decisions start with good questions." description="Open an idea and add an interview, market report, or other source. Your findings will come together here." href="/discover" />}
    </>
  );
}
