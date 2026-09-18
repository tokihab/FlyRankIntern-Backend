"use client";

import { useEffect, useState } from "react";
import { LogOut, Plus, RefreshCw, Trash2 } from "lucide-react";

type Task = { id: number; title: string; done: boolean };

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("Log in with Supabase to manage tasks.");

  const authHeaders = (): Record<string, string> => token ? { Authorization: `Bearer ${token}` } : {};
  const load = async () => {
    if (!token) return;
    const response = await fetch("/api/backend/tasks", { headers: authHeaders(), cache: "no-store" });
    const data = await response.json();
    setTasks(Array.isArray(data) ? data : []);
    setMessage(response.ok ? "SQLite task store connected" : data.error ?? "Unable to load tasks");
  };

  useEffect(() => {
    const storedToken = localStorage.getItem("flyrank_access_token");
    const storedEmail = localStorage.getItem("flyrank_user_email");
    if (storedToken) { setToken(storedToken); setEmail(storedEmail ?? "Authenticated user"); }
  }, []);
  useEffect(() => { if (token) void load(); }, [token]);

  const authenticate = async () => {
    const response = await fetch(`/api/backend/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await response.json();
    if (response.ok && data.access_token) {
      localStorage.setItem("flyrank_access_token", data.access_token);
      localStorage.setItem("flyrank_user_email", data.user?.email ?? email);
      setToken(data.access_token); setEmail(data.user?.email ?? email); setMessage("Supabase session active");
    } else if (response.ok) setMessage("Account created; complete confirmation before logging in.");
    else setMessage(data.error ?? "Authentication failed");
  };
  const logout = () => { localStorage.removeItem("flyrank_access_token"); localStorage.removeItem("flyrank_user_email"); setToken(null); setTasks([]); setMessage("Logged out. Authentication is required to manage tasks."); };
  const add = async () => { if (!token || !title.trim()) return; await fetch("/api/backend/tasks", { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ title }) }); setTitle(""); void load(); };
  const remove = async (id: number) => { if (!token) return; await fetch(`/api/backend/tasks/${id}`, { method: "DELETE", headers: authHeaders() }); void load(); };

  return <section className="mx-auto max-w-6xl px-6 py-10"><Header title="Tasks & Auth" subtitle="Supabase-protected identity and the original SQLite CRUD surface." /><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Session boundary</p><h2 className="mt-4 text-xl font-medium">Supabase Auth</h2>{token ? <div className="mt-5 flex flex-wrap items-center gap-3"><span className="rounded-full bg-emerald-300/15 px-3 py-1 text-xs text-emerald-200">Session Active</span><span className="text-sm text-slate-300">{email}</span><button onClick={logout} className="flex items-center gap-2 rounded-lg bg-rose-400/15 px-3 py-2 text-sm text-rose-200"><LogOut size={15} />Log out</button></div> : <div className="mt-4 space-y-2"><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" /><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" /><div className="flex gap-2"><button onClick={() => void authenticate()} className="rounded-lg bg-emerald-300 px-3 py-2 text-sm text-slate-950">{authMode === "login" ? "Log in" : "Sign up"}</button><button onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")} className="rounded-lg border border-white/10 px-3 py-2 text-sm">Switch to {authMode === "login" ? "sign up" : "login"}</button></div></div>}<p className="mt-4 text-sm leading-6 text-slate-400">{message}</p></div><div className={`relative rounded-2xl border border-white/10 bg-white/[0.04] p-6 ${!token ? "overflow-hidden" : ""}`}>{!token && <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/75 p-6 text-center backdrop-blur-sm"><span className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">Authentication required to view and manage tasks.</span></div>}<div className={!token ? "blur-sm" : ""}><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Task database</p><h2 className="mt-2 text-xl font-medium">SQLite CRUD</h2></div><button onClick={() => void load()} className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white" aria-label="Refresh tasks"><RefreshCw size={16} /></button></div><div className="mt-5 flex gap-2"><input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void add(); }} placeholder="New task title" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" /><button onClick={() => void add()} className="rounded-lg bg-emerald-300 px-3 text-slate-950" aria-label="Add task"><Plus size={17} /></button></div><div className="mt-5 space-y-2">{tasks.map((task) => <div key={task.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-3 text-sm"><span>{task.title}</span><button onClick={() => void remove(task.id)} className="text-slate-500 hover:text-rose-300" aria-label={`Delete ${task.title}`}><Trash2 size={16} /></button></div>)}{tasks.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No tasks returned.</p>}</div></div></div></div></section>;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) { return <div className="mb-8"><p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Unified service</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">{title}</h1><p className="mt-3 text-slate-400">{subtitle}</p></div>; }
