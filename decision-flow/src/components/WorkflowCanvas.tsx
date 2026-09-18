"use client";

import { useCallback, useRef, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Download,
  History,
  Plus,
  Redo2,
  Save,
  Upload,
  Workflow,
  Zap,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import DecisionNode from "@/components/nodes/DecisionNode";
import type { DecisionNode as DecisionNodeType, DecisionNodeData, ExecutionLog, PersistedWorkflow, WorkflowEdge } from "@/lib/workflow-types";

const nodeTypes = { decision: DecisionNode };
const STORAGE_KEY = "flyrank-decision-flow";

type WorkflowCanvasProps = { onLogsChange?: (logs: ExecutionLog[]) => void };

const initialNodes: DecisionNodeType[] = [
  {
    id: "decision-1",
    type: "decision",
    position: { x: 170, y: 170 },
    data: {
      id: "decision-1",
      label: "Support intent",
      prompt: "Is this message asking for customer support?",
      status: "Idle",
      retries: 0,
    } as DecisionNodeData,
  },
  {
    id: "decision-2",
    type: "decision",
    position: { x: 630, y: 80 },
    data: {
      id: "decision-2",
      label: "Urgency check",
      prompt: "Does this request require urgent human attention?",
      status: "Idle",
      retries: 0,
    } as DecisionNodeData,
  },
];

const initialEdges: WorkflowEdge[] = [
  { id: "edge-yes", source: "decision-1", sourceHandle: "yes", target: "decision-2", targetHandle: "input", animated: true, style: { stroke: "#6ee7b7", strokeWidth: 2 }, data: { branch: "YES" }, label: "YES" },
];

function makePersisted(nodes: DecisionNodeType[], edges: WorkflowEdge[]): PersistedWorkflow {
  return {
    nodes: nodes.map(({ data, ...node }) => ({
      ...node,
      data: { id: data.id, label: data.label, prompt: data.prompt, status: data.status, retries: data.retries, decision: data.decision, reason: data.reason },
    })),
    edges,
  };
}

function evaluate(prompt: string): { decision: "YES" | "NO"; reason: string } {
  const normalized = prompt.toLowerCase();
  const negativeSignals = ["not", "no", "exclude", "skip", "spam", "unrelated"];
  const decision = negativeSignals.some((signal) => normalized.includes(signal)) ? "NO" : "YES";
  return { decision, reason: decision === "YES" ? "The prompt matches the workflow's positive intent." : "The prompt contains a negative or exclusion signal." };
}

export default function WorkflowCanvas({ onLogsChange }: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<DecisionNodeType>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(initialEdges);
  const [history, setHistory] = useState<Array<{ nodes: DecisionNodeType[]; edges: WorkflowEdge[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [notice, setNotice] = useState("Ready to run");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateWithHistory = useCallback((nextNodes: DecisionNodeType[], nextEdges: WorkflowEdge[]) => {
    setNodes(nextNodes);
    setEdges(nextEdges);
    setHistory((current) => [...current.slice(0, historyIndex + 1), { nodes: nextNodes, edges: nextEdges }]);
    setHistoryIndex((index) => index + 1);
  }, [historyIndex, setEdges, setNodes]);

  const updateNodeData = useCallback((id: string, patch: Partial<DecisionNodeData>) => {
    setNodes((current) => current.map((node) => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node));
  }, [setNodes]);

  const runNode = useCallback((id: string) => {
    const node = nodes.find((candidate) => candidate.id === id);
    if (!node) return;
    if (!node.data.prompt.trim()) {
      const errorLog: ExecutionLog = { id: crypto.randomUUID(), nodeId: id, nodeLabel: node.data.label, status: "Error", reason: "Add a prompt before running this decision.", timestamp: new Date().toISOString() };
      updateNodeData(id, { status: "Error", reason: errorLog.reason, retries: node.data.retries + 1 });
      setLogs((current) => [errorLog, ...current]);
      setNotice(`${node.data.label} needs a prompt`);
      return;
    }
    updateNodeData(id, { status: "Running" });
    setNotice(`Evaluating ${node.data.label}`);
    window.setTimeout(() => {
      const result = evaluate(node.data.prompt);
      updateNodeData(id, { ...result, status: "Success", retries: node.data.retries });
      const log: ExecutionLog = { id: crypto.randomUUID(), nodeId: id, nodeLabel: node.data.label, status: "Success", ...result, timestamp: new Date().toISOString() };
      setLogs((current) => [log, ...current]);
      onLogsChange?.([log, ...logs]);
      setNotice(`${node.data.label} returned ${result.decision}`);
    }, 650);
  }, [logs, nodes, onLogsChange, updateNodeData]);

  const connectedNodes = nodes.map((node) => ({ ...node, data: { ...node.data, onPromptChange: (id: string, prompt: string) => updateNodeData(id, { prompt }), onRun: runNode } }));

  const onConnect = useCallback((connection: Connection) => {
    const branch = connection.sourceHandle === "no" ? "NO" : "YES";
    const nextEdge: WorkflowEdge = { ...connection, id: `edge-${crypto.randomUUID()}`, animated: true, label: branch, data: { branch }, style: { stroke: branch === "YES" ? "#6ee7b7" : "#fb7185", strokeWidth: 2 } };
    setEdges((current) => addEdge(nextEdge, current));
  }, [setEdges]);

  const saveWorkflow = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makePersisted(nodes, edges)));
    setNotice("Workflow saved locally");
  };

  const loadWorkflow = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) { setNotice("No saved workflow found"); return; }
    try {
      const parsed = JSON.parse(saved) as PersistedWorkflow;
      setNodes(parsed.nodes as DecisionNodeType[]);
      setEdges(parsed.edges);
      setNotice("Workflow restored");
    } catch { setNotice("Saved workflow is invalid"); }
  };

  const exportWorkflow = () => {
    const blob = new Blob([JSON.stringify(makePersisted(nodes, edges), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "flyrank-decision-flow.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("JSON exported");
  };

  const importWorkflow = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as PersistedWorkflow;
        updateWithHistory(parsed.nodes as DecisionNodeType[], parsed.edges);
        setNotice("JSON imported");
      } catch { setNotice("Could not import that JSON file"); }
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const undo = () => {
    if (historyIndex < 0) return;
    const previous = history[historyIndex - 1];
    if (!previous) return;
    setNodes(previous.nodes); setEdges(previous.edges); setHistoryIndex((index) => index - 1); setNotice("Undid last change");
  };

  const redo = () => {
    const next = history[historyIndex + 1];
    if (!next) return;
    setNodes(next.nodes); setEdges(next.edges); setHistoryIndex((index) => index + 1); setNotice("Redid change");
  };

  const addNode = () => {
    const id = `decision-${Date.now()}`;
    const newNode: DecisionNodeType = { id, type: "decision", position: { x: 290 + nodes.length * 30, y: 360 }, data: { id, label: `Decision ${nodes.length + 1}`, prompt: "Should this path continue?", status: "Idle", retries: 0 } as DecisionNodeData };
    updateWithHistory([...nodes, newNode], edges);
  };

  return (
    <main className="flex min-h-screen flex-col overflow-hidden text-slate-100">
      <header className="flex min-h-20 flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-slate-950/65 px-5 py-4 backdrop-blur-xl md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-300 text-slate-950 shadow-lg shadow-emerald-400/20"><Workflow className="h-5 w-5" /></div>
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300">FlyRank / BE-09</p><h1 className="text-lg font-semibold tracking-tight">AI Decision Flow</h1></div>
          <Badge variant="outline" className="hidden border-emerald-300/30 bg-emerald-300/10 text-emerald-200 sm:inline-flex">local workspace</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={undo} disabled={historyIndex < 0} title="Undo"><Undo2 className="mr-1.5 h-3.5 w-3.5" />Undo</Button>
          <Button variant="outline" size="sm" onClick={redo} disabled={!history[historyIndex + 1]} title="Redo"><Redo2 className="mr-1.5 h-3.5 w-3.5" />Redo</Button>
          <Button variant="outline" size="sm" onClick={loadWorkflow}><History className="mr-1.5 h-3.5 w-3.5" />Load</Button>
          <Button variant="outline" size="sm" onClick={saveWorkflow}><Save className="mr-1.5 h-3.5 w-3.5" />Save</Button>
          <Button variant="outline" size="sm" onClick={exportWorkflow}><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-1.5 h-3.5 w-3.5" />Import</Button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={importWorkflow} className="hidden" />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(290px,1fr)]">
        <section className="flow-grid relative min-h-[620px] border-b border-white/10 lg:border-b-0 lg:border-r">
          <ReactFlow nodes={connectedNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange as (changes: NodeChange<DecisionNodeType>[]) => void} onEdgesChange={onEdgesChange as (changes: EdgeChange<WorkflowEdge>[]) => void} onConnect={onConnect} fitView proOptions={{ hideAttribution: true }}>
            <Background color="#4b6472" gap={28} size={1} />
            <Controls className="!border-white/10 !bg-slate-950/80 !fill-slate-200" />
            <MiniMap className="!border-white/10 !bg-slate-950/80" nodeColor="#6ee7b7" maskColor="rgb(15 23 42 / 0.75)" />
            <Panel position="bottom-left" className="!m-5">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/85 px-3 py-2 text-xs text-slate-400 shadow-xl backdrop-blur"><Zap className="h-3.5 w-3.5 text-amber-300" /><span>{notice}</span></div>
            </Panel>
            <Panel position="top-left" className="!m-5">
              <Button size="sm" onClick={addNode} className="bg-slate-900/90 text-slate-200 shadow-xl hover:bg-slate-800"><Plus className="mr-1.5 h-3.5 w-3.5" />Add decision</Button>
            </Panel>
          </ReactFlow>
        </section>
        <aside className="flex min-h-0 flex-col bg-slate-950/45 p-4 md:p-5">
          <Card className="flex min-h-0 flex-1 flex-col border-white/10 bg-slate-950/60">
            <CardHeader className="border-b border-white/10 pb-4"><div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Run history</p><CardTitle className="mt-1 text-base">Execution Logs</CardTitle></div><Badge variant="outline" className="border-amber-300/30 bg-amber-300/10 text-amber-200">{nodes.filter((node) => node.data.status === "Success").length} passed</Badge></div></CardHeader>
            <CardContent className="min-h-0 flex-1 p-0"><ScrollArea className="h-full"><div className="space-y-3 p-4"><div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400"><span className="font-semibold text-slate-200">Tip:</span> connect YES and NO handles to make decisions route through the canvas.</div>{logs.length === 0 ? <p className="py-8 text-center text-xs text-slate-600">Run a decision to create the first log.</p> : logs.map((log) => <div key={log.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-200">{log.nodeLabel}</span><Badge variant="outline" className={log.status === "Success" ? "border-emerald-400/30 text-emerald-300" : "border-rose-400/30 text-rose-300"}>{log.status}</Badge></div>{log.decision && <p className="mt-2 text-xs text-slate-400"><span className="font-semibold text-emerald-300">{log.decision}</span> &middot; {log.reason}</p>}<p className="mt-2 text-[10px] text-slate-600">{new Date(log.timestamp).toLocaleTimeString()} &middot; {nodes.find((node) => node.id === log.nodeId)?.data.retries ?? 0} retries</p></div>)}</div></ScrollArea></CardContent>
          </Card>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center"><div className="rounded-lg border border-white/10 bg-white/[0.03] p-3"><p className="text-xl font-semibold text-slate-100">{nodes.length}</p><p className="text-[10px] uppercase tracking-wider text-slate-500">Nodes</p></div><div className="rounded-lg border border-white/10 bg-white/[0.03] p-3"><p className="text-xl font-semibold text-emerald-300">{edges.length}</p><p className="text-[10px] uppercase tracking-wider text-slate-500">Routes</p></div></div>
        </aside>
      </div>
    </main>
  );
}
