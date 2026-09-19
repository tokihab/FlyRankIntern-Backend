import { NextResponse } from "next/server";
import { findExecution } from "@/lib/execution-store";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const execution = findExecution(runId);
  if (!execution) return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  return NextResponse.json(execution);
}