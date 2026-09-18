export type WorkflowNode = {
  id: string;
  type: 'decision' | 'action' | 'start' | 'end';
  label: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
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
