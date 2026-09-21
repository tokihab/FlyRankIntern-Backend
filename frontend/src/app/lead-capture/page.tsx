"use client";

import { useEffect, useState } from "react";

interface DashboardStats {
  total_submissions: number;
  processed_submissions: number;
  country_breakdown: { country: string; count: number }[];
  recent_submissions: any[];
}

export default function LeadCaptureShowcase() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/dashboard/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to load capstone stats:", err);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Dynamic script injection to handle SPA navigation & re-mounts cleanly
  useEffect(() => {
    const container = document.getElementById("lead-widget-container");
    if (!container) return;

    // Clean existing children to prevent duplicate embeds
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "http://localhost:3000/widget.js?id=w_demo123";
    script.async = true;
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, []);

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Lead Capture & Widget Integration</h1>
        <p className="text-sm text-slate-400">
          Embeddable Shadow DOM lead capture running on Origin 1 (:3000) inside the Unified Dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Embedded Live Widget */}
        <div className="bg-[#111726] border border-slate-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-200 mb-2">Live Embedded Widget</h2>
          <p className="text-xs text-slate-400 mb-6">
            Rendered via <code className="font-mono text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">&lt;script src="http://localhost:3000/widget.js?id=w_demo123"&gt;</code> inside an isolated Shadow DOM.
          </p>

          <div
            id="lead-widget-container"
            className="my-4 min-h-[160px] flex items-center justify-center bg-slate-900/50 rounded-lg p-4 border border-dashed border-slate-700"
          >
            {/* The script automatically injects the form here */}
          </div>
        </div>

        {/* Right Column: Live Aggregates */}
        <div className="bg-[#111726] border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-semibold text-slate-200">Ingestion Telemetry</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400">Total Ingested</span>
              <p className="text-2xl font-bold text-emerald-400">{stats?.total_submissions ?? 0}</p>
            </div>
            <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400">Geo-Enriched</span>
              <p className="text-2xl font-bold text-cyan-400">{stats?.processed_submissions ?? 0}</p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Recent Leads</h3>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {stats?.recent_submissions && stats.recent_submissions.length > 0 ? (
                stats.recent_submissions.map((sub: any) => (
                  <div key={sub.id} className="flex justify-between items-center text-xs bg-slate-900/50 p-2.5 rounded border border-slate-800/80">
                    <span className="font-mono text-slate-300">{sub.payload?.email || sub.id}</span>
                    <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {sub.city ? `${sub.city}, ${sub.country}` : "Processed"}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 italic py-3 text-center">
                  Waiting for incoming lead submissions...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
