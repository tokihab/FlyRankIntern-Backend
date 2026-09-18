import type { DecisionResult } from "@/lib/llm";

export type ExecutionRecord = {
  runId: string;
  nodeId: string;
  status: "Running" | "Success" | "Error";
  result?: DecisionResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const globalStore = globalThis as typeof globalThis & {
  __flyrankExecutionStore?: Map<string, ExecutionRecord>;
};

const store = globalStore.__flyrankExecutionStore ?? new Map<string, ExecutionRecord>();
globalStore.__flyrankExecutionStore = store;

export function createExecution(runId: string, nodeId: string): ExecutionRecord {
  const now = new Date().toISOString();
  const record: ExecutionRecord = { runId, nodeId, status: "Running", createdAt: now, updatedAt: now };
  store.set(runId, record);
  return record;
}

export function getExecution(runId: string): ExecutionRecord | undefined {
  return store.get(runId);
}

export function completeExecution(runId: string, result: DecisionResult): void {
  const record = store.get(runId);
  if (!record) return;
  store.set(runId, { ...record, status: "Success", result, updatedAt: new Date().toISOString() });
}

export function failExecution(runId: string, error: unknown): void {
  const record = store.get(runId);
  if (!record) return;
  store.set(runId, { ...record, status: "Error", error: error instanceof Error ? error.message : "Execution failed", updatedAt: new Date().toISOString() });
}
