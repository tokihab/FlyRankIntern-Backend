import { NextResponse } from "next/server";
import { findExecution } from "@/lib/execution-store";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const execution = findExecution(runId);

  if (!execution) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  // Map execution-store statuses to the UI states expected by WorkflowCanvas
  const status = 
    execution.status === 'completed' ? 'Success' :
    execution.status === 'failed' ? 'Error' : 'Running';

  return NextResponse.json({
    runId: execution.runId,
    nodeId: execution.nodeId,
    status,
    result: execution.result,
    error: execution.error,
    timestamp: execution.timestamp,
  });
}