"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Loader2, Play, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DecisionNodeData, DecisionStatus } from "@/lib/workflow-types";

const statusStyles: Record<DecisionStatus, string> = {
  Idle: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  Running: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  Success: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  Error: "border-rose-400/40 bg-rose-400/10 text-rose-200",
};

export default function DecisionNode(props: NodeProps) {
  const data = props.data as unknown as DecisionNodeData;
  const { selected } = props;
  const isBusy = data.status === "Running";

  return (
    <Card className={`flow-node-enter w-[290px] border-white/10 bg-slate-950/90 shadow-2xl shadow-black/25 ${selected ? "ring-2 ring-emerald-300/80" : ""}`}>
      <Handle id="input" type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-slate-950 !bg-sky-300" />
      <Handle id="yes" type="source" position={Position.Right} style={{ top: "38%" }} className="!h-4 !w-4 !border-2 !border-slate-950 !bg-emerald-400" />
      <Handle id="no" type="source" position={Position.Right} style={{ top: "72%" }} className="!h-4 !w-4 !border-2 !border-slate-950 !bg-rose-400" />

      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Decision node</p>
            <h3 className="text-sm font-semibold text-slate-100">{data.label}</h3>
          </div>
        </div>
        <Badge variant="outline" className={`text-[10px] ${statusStyles[data.status]}`}>{data.status}</Badge>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4">
        <textarea
          aria-label={`${data.label} prompt`}
          value={data.prompt}
          onChange={(event) => data.onPromptChange(data.id, event.target.value)}
          className="nodrag nowheel min-h-20 w-full resize-none rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-5 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/10"
          placeholder="Ask a yes or no question..."
        />
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>{data.retries} {data.retries === 1 ? "retry" : "retries"}</span>
          <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider">
            <span className="text-emerald-300">YES</span>
            <span className="text-slate-700">/</span>
            <span className="text-rose-300">NO</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="nodrag flex-1 bg-emerald-300 text-slate-950 hover:bg-emerald-200" onClick={() => data.onRun(data.id)} disabled={isBusy}>
          {isBusy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : data.status === "Error" ? <RotateCcw className="mr-2 h-3.5 w-3.5" /> : <Play className="mr-2 h-3.5 w-3.5" />}
          {isBusy ? "Evaluating..." : data.status === "Error" ? "Retry decision" : "Run decision"}
          </Button>
          <Button variant="outline" size="icon" className="nodrag border-rose-400/30 text-rose-300 hover:bg-rose-400/10 hover:text-rose-200" onClick={() => data.onDelete(data.id)} title="Delete decision node" aria-label="Delete decision node"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
