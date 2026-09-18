import { inngest } from "@/inngest/client";
import { completeExecution, failExecution } from "@/lib/execution-store";
import { runDecision } from "@/lib/llm";

export const runDecisionNode = inngest.createFunction(
  { id: "run-decision-node", retries: 2, triggers: [{ event: "workflow/execute-node" }] },
  async ({ event, step }) => {
    const { runId, nodeId, prompt } = event.data as { runId: string; nodeId: string; prompt: string };
    try {
      const result = await step.run("evaluate-decision", () => runDecision(prompt));
      completeExecution(runId, result);
      return { runId, nodeId, ...result };
    } catch (error) {
      failExecution(runId, error);
      throw error;
    }
  },
);
