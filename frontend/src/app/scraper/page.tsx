"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Search, Trash2, Download, FileText, Filter, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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

type GeneratedReport = {
  id: string;
  report_type: string;
  file: string;
  status: string;
  valid_records: number;
  created_at: string;
  cached?: boolean;
};

type ReportMetrics = {
  total_count?: number;
  average_price?: number;
  top_expensive?: Array<{ title: string; price: number; rating: number }>;
  rating_breakdown?: Array<{ rating: string; count: number }>;
  top_authors?: Array<{ author: string; count: number }>;
  tag_breakdown?: Array<{ tag: string; count: number }>;
};

const BOOKS_URL = "http://books.toscrape.com";
const QUOTES_URL = "http://quotes.toscrape.com";
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function ScraperPage() {
  const [records, setRecords] = useState<ScrapedEntity[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [query, setQuery] = useState("");
  const [targetUrl, setTargetUrl] = useState(BOOKS_URL);
  const [status, setStatus] = useState("Loading scraper artifacts...");
  const [loading, setLoading] = useState(false);
  
  // Report generation state
  const [reportType, setReportType] = useState<'books' | 'quotes'>('books');
  const [minRating, setMinRating] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [forceFresh, setForceFresh] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [reportMetrics, setReportMetrics] = useState<ReportMetrics | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

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

  const loadReports = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/reports`, { cache: "no-store" });
      if (response.ok) {
        const reports = await response.json();
        setGeneratedReports(reports);
      }
    } catch (error) {
      console.error("Failed to load reports:", error);
    }
  };

  const generateReport = async () => {
    setGeneratingReport(true);
    setReportError(null);
    setReportMetrics(null);
    
    try {
      const filters: Record<string, unknown> = {};
      
      if (reportType === 'books') {
        if (minRating) filters.min_rating = Number(minRating);
        if (maxPrice) filters.max_price = Number(maxPrice);
      } else {
        if (tagFilter) filters.tag = tagFilter;
      }
      
      const response = await fetch(`${BACKEND_URL}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: reportType, filters, force: forceFresh }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setReportError(null);
        
        // If cached, fetch the metrics from the existing report
        if (data.cached) {
          const reportDataResponse = await fetch(`${BACKEND_URL}/reports/${data.id}`);
          if (reportDataResponse.ok) {
            const reportData = await reportDataResponse.json();
            // Extract metrics from the report data
            const metrics: ReportMetrics = {};
            if (reportType === 'books') {
              const booksResponse = await fetch(`${BACKEND_URL}/internal/reports/prepare`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: reportType, filters }),
              });
              if (booksResponse.ok) {
                const booksData = await booksResponse.json();
                setReportMetrics(booksData.reportData.summary);
              }
            }
          }
        }
        
        // Reload reports list
        await loadReports();
        
        setStatus(`Report ${data.cached ? 'retrieved from cache' : 'generation queued'}`);
      } else {
        setReportError(data.error || 'Failed to generate report');
        setStatus("Report generation failed");
      }
    } catch (error) {
      setReportError('Failed to generate report');
      setStatus("Report generation failed");
    } finally {
      setGeneratingReport(false);
    }
  };

  const fetchReportMetrics = async () => {
    try {
      const filters: Record<string, unknown> = {};
      if (reportType === 'books') {
        if (minRating) filters.min_rating = Number(minRating);
        if (maxPrice) filters.max_price = Number(maxPrice);
      } else {
        if (tagFilter) filters.tag = tagFilter;
      }
      
      const response = await fetch(`${BACKEND_URL}/internal/reports/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: reportType, filters }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setReportMetrics(data.reportData.summary);
      }
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    }
  };

  // Load reports on mount
  useEffect(() => {
    void load();
    void loadReports();
  }, []);

  // Update metrics when filters change
  useEffect(() => {
    if (records.length > 0) {
      void fetchReportMetrics();
    }
  }, [reportType, minRating, maxPrice, tagFilter, records.length]);

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

      {/* Report Generation Panel */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1">Report Generator</p>
            <h2 className="text-xl font-semibold text-slate-200">Generate PDF Report</h2>
          </div>
          <Badge variant={generatedReports.length > 0 ? "default" : "secondary"}>
            {generatedReports.length} reports
          </Badge>
        </div>

        <div className="grid gap-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="report-type" className="mb-2 text-sm text-slate-400">
                Dataset Type
              </Label>
              <Select
                value={reportType}
                onValueChange={(value: 'books' | 'quotes') => setReportType(value)}
                disabled={generatingReport}
              >
                <SelectTrigger className="w-full bg-slate-950 border-white/10 text-slate-200">
                  <SelectValue placeholder="Select dataset type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  <SelectItem value="books" className="text-slate-200 focus:bg-slate-800">
                    Books
                  </SelectItem>
                  <SelectItem value="quotes" className="text-slate-200 focus:bg-slate-800">
                    Quotes
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportType === 'books' && (
              <>
                <div>
                  <Label htmlFor="min-rating" className="mb-2 text-sm text-slate-400">
                    Min Rating
                  </Label>
                  <Select
                    value={minRating}
                    onValueChange={setMinRating}
                    disabled={generatingReport}
                  >
                    <SelectTrigger className="w-full bg-slate-950 border-white/10 text-slate-200">
                      <SelectValue placeholder="Any rating" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10">
                      <SelectItem value="" className="text-slate-200 focus:bg-slate-800">Any rating</SelectItem>
                      <SelectItem value="5" className="text-slate-200 focus:bg-slate-800">5 Stars</SelectItem>
                      <SelectItem value="4" className="text-slate-200 focus:bg-slate-800">4 Stars</SelectItem>
                      <SelectItem value="3" className="text-slate-200 focus:bg-slate-800">3 Stars</SelectItem>
                      <SelectItem value="2" className="text-slate-200 focus:bg-slate-800">2 Stars</SelectItem>
                      <SelectItem value="1" className="text-slate-200 focus:bg-slate-800">1 Star</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="max-price" className="mb-2 text-sm text-slate-400">
                    Max Price (£)
                  </Label>
                  <Input
                    id="max-price"
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Any price"
                    className="w-full bg-slate-950 border-white/10 text-slate-200"
                    disabled={generatingReport}
                  />
                </div>
              </>
            )}

            {reportType === 'quotes' && (
              <div className="md:col-span-2">
                <Label htmlFor="tag-filter" className="mb-2 text-sm text-slate-400">
                  Filter by Tag
                </Label>
                <Input
                  id="tag-filter"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  placeholder="Enter tag to filter"
                  className="w-full bg-slate-950 border-white/10 text-slate-200"
                  disabled={generatingReport}
                />
              </div>
            )}

            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 mb-2">
                <Label className="text-sm text-slate-400">
                  Force Fresh Generation
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="force-fresh"
                  checked={forceFresh}
                  onChange={(e) => setForceFresh(e.target.checked)}
                  className="w-4 h-4 bg-slate-950 border-white/10"
                  disabled={generatingReport}
                />
                <Label htmlFor="force-fresh" className="text-sm text-slate-400">
                  Generate new report even if cached version exists
                </Label>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => void generateReport()}
              disabled={generatingReport || records.length === 0}
              className="bg-emerald-300 text-slate-950 flex items-center gap-2"
            >
              {generatingReport ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText size={16} />
                  Generate PDF Report
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => void fetchReportMetrics()}
              disabled={generatingReport}
              className="border-white/10 text-slate-200"
            >
              <RefreshCw size={16} />
              Refresh Metrics
            </Button>
          </div>
        </div>

        {/* Quick SQL Metrics Grid */}
        {reportMetrics && (
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-3">
              SQL Metrics Preview
            </p>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {reportType === 'books' && (
                <>
                  <Card className="bg-white/[0.02] border-white/5">
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-500">Total Books</p>
                      <p className="text-2xl font-semibold text-slate-200">
                        {reportMetrics.total_count ?? 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/[0.02] border-white/5">
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-500">Avg Price</p>
                      <p className="text-2xl font-semibold text-slate-200">
                        £{(reportMetrics.average_price ?? 0).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/[0.02] border-white/5">
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-500">Top Expensive</p>
                      <p className="text-lg font-semibold text-slate-200">
                        {(reportMetrics.top_expensive ?? [])[0]?.title ?? 'N/A'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/[0.02] border-white/5">
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-500">Ratings</p>
                      <p className="text-lg font-semibold text-slate-200">
                        {(reportMetrics.rating_breakdown ?? []).map(r => `${r.rating}: ${r.count}`).join(', ') || 'N/A'}
                      </p>
                    </CardContent>
                  </Card>
                </>
              )}
              {reportType === 'quotes' && (
                <>
                  <Card className="bg-white/[0.02] border-white/5">
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-500">Total Quotes</p>
                      <p className="text-2xl font-semibold text-slate-200">
                        {reportMetrics.total_count ?? 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/[0.02] border-white/5">
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-500">Top Author</p>
                      <p className="text-lg font-semibold text-slate-200">
                        {(reportMetrics.top_authors ?? [])[0]?.author ?? 'N/A'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/[0.02] border-white/5">
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-500">Total Authors</p>
                      <p className="text-lg font-semibold text-slate-200">
                        {(reportMetrics.top_authors ?? []).length}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/[0.02] border-white/5">
                    <CardContent className="pt-4">
                      <p className="text-xs text-slate-500">Tags</p>
                      <p className="text-lg font-semibold text-slate-200">
                        {(reportMetrics.tag_breakdown ?? []).map(t => `${t.tag}: ${t.count}`).join(', ') || 'N/A'}
                      </p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {reportError && (
          <div className="mt-4 p-3 bg-rose-900/20 border border-rose-600 rounded-lg">
            <p className="text-sm text-rose-400">{reportError}</p>
          </div>
        )}
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

      {/* Report History */}
      {generatedReports.length > 0 && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-200">Report History</h3>
          </div>
          <div className="space-y-3">
            {generatedReports.slice().reverse().map((report) => (
              <Card
                key={report.id}
                className="bg-white/[0.02] border-white/5 overflow-hidden"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm text-slate-200">
                        {report.report_type.toUpperCase()} Report
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        {new Date(report.created_at).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                      {report.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      {report.valid_records} records
                    </div>
                    <a
                      href={`${BACKEND_URL}${report.file}`}
                      download
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <Download size={12} /> Download PDF
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

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
