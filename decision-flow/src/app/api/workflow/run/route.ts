import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { createExecution } from "@/lib/execution-store";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { nodeId?: string; prompt?: string };
    if (!body.nodeId || !body.prompt?.trim()) {
      return NextResponse.json({ error: "nodeId and prompt are required" }, { status: 400 });
    }

    const runId = crypto.randomUUID();
    createExecution(runId, body.nodeId);
    await inngest.send({
      name: "workflow/execute-node",
      data: { runId, nodeId: body.nodeId, prompt: body.prompt.trim() },
    });

    return NextResponse.json({ runId, status: "Running" }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not dispatch workflow" }, { status: 500 });
  }
}
