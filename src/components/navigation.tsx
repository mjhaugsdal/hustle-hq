"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, BookOpen, Columns3, FlaskConical, Activity, ArrowUpRight, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

const links = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/research", label: "Research library", icon: BookOpen },
  { href: "/compare", label: "Compare ideas", icon: Columns3 },
  { href: "/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/activity", label: "Activity", icon: Activity },
];
export function Navigation() {
  const path = usePathname();
  return <nav aria-label="Main navigation" className="navigation">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("nav-link", (path === href || (href === "/discover" && path.startsWith("/ideas/"))) && "active")} aria-current={path === href ? "page" : undefined}><Icon size={19} strokeWidth={1.7} /><span>{label}</span><ArrowUpRight size={14} className="nav-arrow" /></Link>)}<form action={signOut} className="mobile-signout"><SubmitButton variant="ghost" className="nav-link" pendingLabel="Signing out…"><LogOut size={15} />Sign out</SubmitButton></form></nav>;
}
