import Link from "next/link";
import { Zap, LogOut, LockKeyhole, ChevronDown, Sparkles } from "lucide-react";
import { getWorkspaceData } from "@/lib/data";
import { signOut } from "@/app/actions";
import { Navigation } from "@/components/navigation";
import { SubmitButton } from "@/components/submit-button";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { workspace, user } = await getWorkspaceData();
  return <div className="app-shell"><aside className="sidebar"><Link href="/discover" className="brand"><span className="brand-mark"><Zap size={23} fill="currentColor" /></span><span>side hustle<span className="brand-hq">HQ</span></span></Link><div className="workspace-switch"><span className="workspace-avatar">{workspace.name.slice(0, 1).toUpperCase()}</span><div><small>YOUR WORKSPACE</small><strong>{workspace.name}</strong></div><ChevronDown size={14} /></div><div className="nav-label">BUILD SOMETHING GOOD</div><Navigation /><div className="sidebar-bottom"><div className="sidebar-note"><Sparkles size={19} /><strong>Small bets. Big possibilities.</strong><p>You don’t need a perfect idea.<br />You need a thoughtful next step.</p></div><div className="member"><span className="member-avatar">{(user.email || "You").slice(0, 1).toUpperCase()}</span><div><strong>Your workspace</strong><small>{user.email || "Signed in"}</small></div><form action={signOut}><SubmitButton variant="ghost" size="icon" aria-label="Sign out" pendingLabel="…"><LogOut size={17} /></SubmitButton></form></div></div></aside><div className="workspace-main"><div className="topbar"><span><span className="live-dot" /> Your next chapter starts here</span><span className="topbar-private"><LockKeyhole size={13} /> Invite-only workspace</span></div><main id="main-content" className="main-content">{children}</main><footer className="workspace-footer"><span>Built for possibilities. Grounded in evidence.</span><span>SIDE HUSTLE HQ <Zap size={11} /></span></footer></div></div>;
}
