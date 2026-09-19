"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ScrapedEntity = {
  entity: 'book' | 'quote' | 'article';
  [key: string]: any;
};

type Report = {
  valid_records?: number;
  invalid_records?: number;
  duration_ms?: number;
  cache_hits?: number;
  failed_pages?: number;
};

const BOOKS_URL = "http://books.toscrape.com";
const QUOTES_URL = "http://quotes.toscrape.com";

export default function ScraperPage() {
  const [records, setRecords] = useState<ScrapedEntity[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [query, setQuery] = useState("");
  const [targetUrl, setTargetUrl] = useState(BOOKS_URL);
  const [status, setStatus] = useState("Loading scraper artifacts...");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/backend/api/scraper/data", { cache: "no-store" });
      const data = await response.json();
      
      // Combine all record types
      const allRecords: ScrapedEntity[] = [
        ...(data.books || []),
        ...(data.quotes || []),
        ...(data.articles || [])
      ];
      
      setRecords(allRecords);
      setReport(data.report);
      setStatus(response.ok ? "Artifacts loaded" : data.error ?? "Backend unavailable");
    } catch (error) {
      setStatus("Failed to load artifacts");
      setRecords([]);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const trigger = async () => {
    setLoading(true);
    setStatus("Scraper running politely...");
    try {
      const response = await fetch("/api/backend/api/scraper/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl })
      });
      const data = await response.json();
      setStatus(response.ok ? `${data.status ?? "completed"} for ${targetUrl}` : data.error ?? "Scraper failed");
      await load(); // Reload data after scraping
    } catch (error) {
      setStatus("Scraper failed");
    } finally {
      setLoading(false);
    }
  };

  const clearData = async () => {
    setLoading(true);
    try {
      // Clear all scraper output files by triggering with empty data
      await fetch("/api/backend/api/scraper/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl: '' })
      });
      setRecords([]);
      setReport(null);
      setStatus("Data cleared");
    } catch (error) {
      setStatus("Failed to clear data");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => 
    records.filter((record) => 
      JSON.stringify(record).toLowerCase().includes(query.toLowerCase())
    ),
    [records, query]
  );

  // Generate dynamic table headers based on the first record
  const getTableHeaders = () => {
    if (filtered.length === 0) return [];
    const firstRecord = filtered[0];
    // Filter out internal fields like 'entity' and 'url' from display
    return Object.keys(firstRecord).filter(key => !['entity', 'url'].includes(key));
  };

  // Get display value for a cell
  const getCellValue = (record: ScrapedEntity, key: string) => {
    const value = record[key];
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  };

  // Get entity type for display
  const getEntityLabel = (entity: string) => {
    switch (entity) {
      case 'book': return 'Books';
      case 'quote': return 'Quotes';
      case 'article': return 'Articles';
      default: return entity;
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <Header title="Polite Scraper" subtitle="Browse the validated scraped dataset and trigger the resilient pipeline." />
      
      <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500" htmlFor="target-url">
          Target URL
        </label>
        <div className="flex flex-col gap-2 lg:flex-row">
          <input
            id="target-url"
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-300"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTargetUrl(BOOKS_URL)}
            disabled={loading}
          >
            Reset to Books
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-amber-300/30 bg-amber-300/10 text-amber-100"
            onClick={() => setTargetUrl(QUOTES_URL)}
            disabled={loading}
          >
            Quotes Sandbox
          </Button>
          <Button
            onClick={() => void trigger()}
            className="bg-emerald-300 text-slate-950"
            disabled={loading}
          >
            <Play size={16} /> {loading ? 'Running...' : 'Run scraper'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void clearData()}
            disabled={loading}
            className="border-rose-400/30 text-rose-300"
          >
            <Trash2 size={16} /> Clear
          </Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-500">{status}</span>
        {records.length > 0 && (
          <span className="text-xs text-emerald-300">
            Showing {filtered.length} of {records.length} {getEntityLabel(records[0].entity)} records
          </span>
        )}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Valid records", report?.valid_records ?? 0],
          ["Cache hits", report?.cache_hits ?? 0],
          ["Failed pages", report?.failed_pages ?? 0],
          ["Invalid", report?.invalid_records ?? 0],
          ["Duration", `${report?.duration_ms ?? 0} ms`]
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter records"
            className="w-full rounded-lg border border-white/10 bg-slate-950 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-300"
          />
        </div>
        
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              {records.length === 0 ? 'No records yet. Run the scraper to load data.' : 'No matching records found.'}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  {getTableHeaders().map((header) => (
                    <th key={header} className="py-3">
                      {header.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((record, index) => (
                  <tr key={`${record.entity}-${record.url || index}`} className="border-b border-white/5">
                    {getTableHeaders().map((key) => (
                      <td key={key} className="py-3 pr-4 text-slate-200">
                        {getCellValue(record, key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Unified service</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-slate-400">{subtitle}</p>
    </div>
  );
}
