"use client";

import { useState, useCallback } from "react";

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

export function useScraper() {
  const [records, setRecords] = useState<ScrapedEntity[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const fetchScraperData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/backend/api/scraper/data", { cache: "no-store" });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch scraper data");
      }
      
      // Combine all record types
      const allRecords: ScrapedEntity[] = [
        ...(data.books || []),
        ...(data.quotes || []),
        ...(data.articles || [])
      ];
      
      setRecords(allRecords);
      setReport(data.report);
      setStatus("Artifacts loaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("Failed to load artifacts");
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerScraper = useCallback(async (targetUrl: string) => {
    setLoading(true);
    setError(null);
    setStatus("Scraper running...");
    
    try {
      const response = await fetch("/api/backend/api/scraper/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Scraper run failed");
      }
      
      setStatus(`${data.status ?? "completed"} for ${targetUrl}`);
      await fetchScraperData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("Scraper failed");
    } finally {
      setLoading(false);
    }
  }, [fetchScraperData]);

  return {
    records,
    report,
    loading,
    error,
    status,
    fetchScraperData,
    triggerScraper
  };
}
