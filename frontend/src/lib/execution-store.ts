type Execution = {
  id: string;
  runId: string;
  nodeId: string;
  status: 'pending' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  timestamp: string;
};

const executions: Map<string, Execution> = new Map();

export function startExecution(runId: string, nodeId: string): Execution {
  const execution: Execution = {
    id: `${runId}-${nodeId}-${Date.now()}`,
    runId,
    nodeId,
    status: 'pending',
    timestamp: new Date().toISOString(),
  };
  executions.set(execution.id, execution);
  return execution;
}

export function completeExecution(runId: string, result: unknown): Execution | undefined {
  const execution = findExecution(runId);
  if (!execution) return undefined;

  execution.status = 'completed';
  execution.result = result;
  return execution;
}

export function failExecution(runId: string, error: unknown): Execution | undefined {
  const execution = findExecution(runId);
  if (!execution) return undefined;

  execution.status = 'failed';
  execution.error = error instanceof Error ? error.message : String(error);
  return execution;
}

export function findExecution(runId: string): Execution | undefined {
  for (const execution of executions.values()) {
    if (execution.runId === runId) {
      return execution;
    }
  }
  return undefined;
}

export function getExecution(runId: string, nodeId?: string): Execution | undefined {
  if (!nodeId) {
    return findExecution(runId);
  }
  for (const execution of executions.values()) {
    if (execution.runId === runId && execution.nodeId === nodeId) {
      return execution;
    }
  }
  return undefined;
}

export function getAllExecutions(): Execution[] {
  return Array.from(executions.values());
}