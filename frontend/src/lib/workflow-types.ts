import type { Node, Edge } from "@xyflow/react";

export type DecisionStatus = "Idle" | "Running" | "Success" | "Error";

export type DecisionNodeData = {
  id?: string;
  label: string;
  question?: string;
  prompt: string;
  status: DecisionStatus;
  result?: "YES" | "NO" | string | null;
  reason?: string | null;
  retries: number;
  onPromptChange?: (nodeId: string, prompt: string) => void;
  onRun?: (id: string) => void | Promise<void>;
  onDelete?: (id: string) => void;
  [key: string]: any;
};

export type DecisionNode = Node<DecisionNodeData, "decision">;

export type WorkflowNode = {
  id: string;
  type: "decision" | "action" | "start" | "end" | string;
  label?: string;
  position: { x: number; y: number };
  data: DecisionNodeData | Record<string, any>;
};

export type WorkflowEdge = Edge & {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  animated?: boolean;
  label?: string;
  type?: string;
  style?: Record<string, any>;
  className?: string;
  data?: Record<string, any>;
  [key: string]: any;
};

export type ExecutionLog = {
  id: string;
  runId?: string;
  nodeId?: string;
  nodeLabel?: string;
  status?: DecisionStatus | string;
  decision?: "YES" | "NO" | string | null;
  reason?: string | null;
  timestamp: string;
  durationMs?: number;
  [key: string]: any;
};

export type PersistedWorkflow = {
  nodes: DecisionNode[] | WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
  [key: string]: any;
};

export type Workflow = {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export type ExecutionResult = {
  runId: string;
  nodeId: string;
  result: unknown;
  timestamp: string;
};