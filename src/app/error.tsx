"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content" className="standalone-state"><div className="empty-icon">↻</div><h1>A small detour.</h1><p>We couldn’t load this part of your workspace. Try again, or head back to your ideas.</p><div className="button-row"><Button onClick={reset}>Try again</Button><Link href="/discover" className="button button-outline">Back to ideas</Link></div></main>;
}
