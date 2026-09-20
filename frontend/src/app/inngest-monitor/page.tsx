"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Trash2 } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type JobStatus = 'pending' | 'done' | 'failed';

interface JobReport {
  id: string;
  topic: string;
  status: JobStatus;
  result: string | null;
  error?: string;
  created_at: string;
  updated_at: string;
}

export default function InngestMonitorPage() {
  const [topic, setTopic] = useState("");
  const [jobReports, setJobReports] = useState<JobReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);

  const presetTopics = ["cats", "fail", "analytics"];

  const fetchJobReports = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/reports`);
      if (response.ok) {
        const data = await response.json();
        // Filter to only job reports (those with topic field)
        const jobs = data.filter((r: JobReport) => r.topic !== undefined);
        setJobReports(jobs);
      }
    } catch (error) {
      console.error("Failed to fetch job reports:", error);
    }
  };

  const triggerJob = async () => {
    if (!topic.trim()) return;
    
    setLoading(true);
    setActiveJobId(null);
    setJobStatus(null);
    
    try {
      const response = await fetch(`${BACKEND_URL}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() })
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveJobId(data.id);
        setJobStatus('pending');
        setTopic("");
        
        // Start polling
        pollJobStatus(data.id);
      } else {
        const error = await response.json();
        console.error("Failed to trigger job:", error);
      }
    } catch (error) {
      console.error("Failed to trigger job:", error);
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/reports/${jobId}`);
        if (response.ok) {
          const data = await response.json();
          setJobStatus(data.status);
          
          if (data.status === 'done' || data.status === 'failed') {
            clearInterval(interval);
            fetchJobReports();
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 1000);
    
    // Cleanup after 30 seconds
    setTimeout(() => {
      clearInterval(interval);
    }, 30000);
  };

  const deleteJob = async (jobId: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/reports/${jobId}`, {
        method: "DELETE"
      });
      
      if (response.ok) {
        fetchJobReports();
      }
    } catch (error) {
      console.error("Failed to delete job:", error);
    }
  };

  useEffect(() => {
    fetchJobReports();
    const interval = setInterval(fetchJobReports, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-900/30 text-amber-300 border-amber-600';
      case 'done':
        return 'bg-emerald-900/30 text-emerald-300 border-emerald-600';
      case 'failed':
        return 'bg-rose-900/30 text-rose-300 border-rose-600';
      default:
        return 'bg-slate-800 text-slate-300';
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">BE-09 operations</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Inngest Monitor</h1>
        <p className="mt-3 text-slate-400">The local dashboard shows queued events, retries, and completed background runs.</p>
      </div>

      {/* A7 Background Job Orchestrator Card */}
      <Card className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardTitle className="text-xl">A7 Background Job Orchestrator</CardTitle>
          <CardDescription>
            Trigger and monitor background report generation jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Input with Presets */}
            <div className="flex flex-wrap gap-2">
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter topic..."
                className="flex-1 min-w-[200px] bg-slate-950 border-white/10 text-slate-200"
              />
              {presetTopics.map((preset) => (
                <Button
                  key={preset}
                  variant="outline"
                  size="sm"
                  onClick={() => setTopic(preset)}
                  className="border-white/10 text-slate-300"
                >
                  {preset}
                </Button>
              ))}
            </div>
            
            {/* Submit Button */}
            <Button
              onClick={triggerJob}
              disabled={loading || !topic.trim()}
              className="bg-emerald-300 text-slate-950"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Triggering...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Trigger Background Job
                </>
              )}
            </Button>

            {/* Active Job Status */}
            {activeJobId && (
              <Card className="bg-white/[0.02] border-white/5">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Active Job</p>
                      <p className="text-sm font-mono text-slate-200">{activeJobId}</p>
                    </div>
                    <Badge className={getStatusColor(jobStatus || 'pending')}>
                      {jobStatus || 'pending'}
                    </Badge>
                  </div>
                  {jobStatus === 'done' && (
                    <p className="mt-2 text-sm text-emerald-400">Job completed successfully!</p>
                  )}
                  {jobStatus === 'failed' && (
                    <p className="mt-2 text-sm text-rose-400">Job failed after retries</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Job Reports List */}
      {jobReports.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-200">
            Recent Job Reports ({jobReports.length})
          </h2>
          <div className="space-y-3">
            {jobReports.slice().reverse().map((report) => (
              <Card
                key={report.id}
                className="bg-white/[0.02] border-white/5 overflow-hidden"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm text-slate-200">
                        {report.topic}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        {new Date(report.created_at).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(report.status)}>
                      {report.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500 max-w-[70%] truncate">
                      {report.result || report.error || 'No result yet'}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteJob(report.id)}
                      className="h-6 px-2 text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Inngest Dashboard Embed */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-2">
        <iframe
          title="Inngest Dev Server dashboard"
          src="http://localhost:8288"
          className="h-[70vh] min-h-[520px] w-full rounded-xl bg-white"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm text-slate-500">
          <span>If the embedded view is blocked, open the dashboard directly.</span>
          <a
            href="http://localhost:8288"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-300 hover:underline"
          >
            Open Inngest at localhost:8288
          </a>
        </div>
      </div>
    </section>
  );
}
