"use client";

import { Activity, Bot, Database, GitBranch, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

const services = [
  ["Core API", "SQLite tasks and REST services", "3000", Database],
  ["Supabase Auth", "JWT-protected identity boundary", "ready", ShieldCheck],
  ["Support Triage", "Groq classification with quarantine", "live", Bot],
  ["Decision Flow", "Inngest-backed YES / NO nodes", "3002", GitBranch],
] as const;

// Service check functions with individual timeouts
const checkServices = async () => {
  // Run all checks concurrently with timeout
  const results = await Promise.allSettled([
    Promise.race([
      fetch("/api/backend/health").then(r => r.json()).then(d => ({ db: d.services?.db })),
      new Promise(resolve => setTimeout(resolve, 2000, { db: false }))
    ]),
    Promise.race([
      fetch("/api/backend/health").then(r => r.json()).then(d => ({ auth: d.services?.auth })),
      new Promise(resolve => setTimeout(resolve, 2000, { auth: false }))
    ]),
    Promise.race([
      fetch("/api/backend/health").then(r => r.json()).then(d => ({ llm: d.services?.llm })),
      new Promise(resolve => setTimeout(resolve, 2000, { llm: false }))
    ])
  ]);

  // Merge results
  const merged: Record<string, boolean> = {};
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      Object.assign(merged, result.value);
    }
  });

  return merged;
};

export default function Home() {
  const [health, setHealth] = useState<Record<string, boolean> | null>(null);
  
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await checkServices();
        setHealth(data);
      } catch {
        setHealth(null);
      }
    };
    
    void fetchHealth();
    
    // Optional: refresh every 30 seconds
    const interval = setInterval(() => {
      void fetchHealth();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <div className="mb-10 max-w-3xl">
        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-emerald-300">BE-01 to BE-09</p>
        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
          One control room for the whole internship stack.
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Tasks, identity, scraped data, support intelligence, and durable decision workflows in one operational surface.
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {services.map(([name, description, state, Icon], index) => {
          const liveState = 
            index === 0 ? health?.db :
            index === 1 ? health?.auth :
            index === 2 ? health?.llm :
            true;
          
          return (
            <div key={name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <Icon className="mb-10 text-emerald-300" size={22} />
              <p className="text-lg font-medium">{name}</p>
              <p className="mt-2 min-h-10 text-sm leading-5 text-slate-400">{description}</p>
              <p className={`mt-5 text-xs uppercase tracking-[0.18em] ${liveState === false ? "text-rose-300" : "text-emerald-300"}`}>
                {liveState === undefined ? "checking" : liveState ? state : "offline"}
              </p>
            </div>
          );
        })}
      </div>
      
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Request path</p>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-lg bg-emerald-300 px-3 py-2 text-slate-950">Browser</span>
            <span className="text-slate-600">{'->'}</span>
            <span className="rounded-lg border border-white/10 px-3 py-2">Next.js hub</span>
            <span className="text-slate-600">{'->'}</span>
            <span className="rounded-lg border border-white/10 px-3 py-2">Express API</span>
            <span className="text-slate-600">{'->'}</span>
            <span className="rounded-lg border border-white/10 px-3 py-2">SQLite / Groq / Supabase</span>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-6">
          <Activity className="text-emerald-300" size={22} />
          <p className="mt-5 font-medium">Platform health</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Use the sidebar to exercise each service independently, then inspect the background workflow in the Flow and Inngest views.
          </p>
        </div>
      </div>
    </section>
  );
}
