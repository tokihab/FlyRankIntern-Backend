"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, Database, GitBranch, Home, Menu, Network, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

const items = [
  ["/", "Overview", Home],
  ["/tasks", "Tasks & Auth", ShieldCheck],
  ["/scraper", "Polite Scraper", Database],
  ["/triage", "AI Triage", Bot],
  ["/flow", "Decision Flow", GitBranch],
  ["/inngest-monitor", "Inngest Monitor", Network],
] as const;

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <button className="fixed left-4 top-4 z-50 rounded-lg border border-white/10 bg-slate-900 p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle navigation">
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-white/10 bg-slate-950/95 p-5 backdrop-blur-xl transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-10 flex items-center gap-3 px-2">
          <div className="rounded-xl bg-emerald-300 p-2 text-slate-950"><Activity size={19} /></div>
          <div><p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">FlyRank platform</p><p className="font-semibold">Control room</p></div>
        </div>
        <nav className="space-y-1">
          {items.map(([href, label, Icon]) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? "bg-emerald-300 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon size={17} />{label}</Link>;
          })}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-500"><p className="mb-1 text-emerald-300">Unified services</p>Express + SQLite + Supabase + Inngest</div>
      </aside>
      <main className="min-h-screen lg:pl-64">{children}</main>
    </div>
  );
}
