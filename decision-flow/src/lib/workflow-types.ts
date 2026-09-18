import type { Edge, Node } from "@xyflow/react";

export type DecisionStatus = "Idle" | "Running" | "Success" | "Error";

export type DecisionNodeData = {
  id: string;
  label: string;
  prompt: string;
  status: DecisionStatus;
  retries: number;
  decision?: "YES" | "NO";
  reason?: string;
  onPromptChange: (id: string, prompt: string) => void;
  onRun: (id: string) => void;
};

export type DecisionNode = Node<DecisionNodeData, "decision">;
export type WorkflowEdge = Edge<{ branch?: "YES" | "NO" }>;

export type PersistedWorkflow = {
  nodes: Array<Omit<DecisionNode, "data"> & { data: Omit<DecisionNodeData, "onPromptChange" | "onRun"> }>;
  edges: WorkflowEdge[];
};

export type ExecutionLog = {
  id: string;
  nodeId: string;
  nodeLabel: string;
  status: DecisionStatus;
  decision?: "YES" | "NO";
  reason: string;
  timestamp: string;
};
