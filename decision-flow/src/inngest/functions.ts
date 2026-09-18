import { inngest } from "@/inngest/client";
import { runDecision } from "@/lib/llm";

export const runDecisionNode = inngest.createFunction(
  { id: "run-decision-node", retries: 2, triggers: [{ event: "ai-decision-flow/node.requested" }] },
  async ({ event, step }) => {
    const { nodeId, prompt } = event.data as { nodeId: string; prompt: string };
    const result = await step.run("evaluate-decision", () => runDecision(prompt));
    return { nodeId, ...result };
  },
);
