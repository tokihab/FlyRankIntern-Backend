import { inngest } from "@/inngest/client";
import { completeExecution, failExecution } from "@/lib/execution-store";
import { runDecision } from "@/lib/llm";

export const runDecisionNode = inngest.createFunction(
  { 
    id: "run-decision-node", 
    retries: 3, 
    timeout: 60,
    triggers: [{ event: "workflow/execute-node" }] 
  },
  async ({ event, step }) => {
    const { runId, nodeId, prompt } = event.data as { runId: string; nodeId: string; prompt: string };
    
    try {
      // Use step.run to enable Inngest to track the operation
      const result = await step.run("evaluate-decision", () => runDecision(prompt));
      
      // Ensure the result has the expected structure for the workflow
      const decisionResult = {
        runId,
        nodeId,
        decision: result.category === 'bug' || result.category === 'billing' ? 'YES' : 'NO',
        reason: result.reason || 'No reason provided',
        ...result
      };
      
      completeExecution(runId, decisionResult);
      return decisionResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failExecution(runId, error);
      
      // Return a structured error that the UI can display
      return {
        runId,
        nodeId,
        status: 'Error',
        error: errorMessage,
        decision: 'NO',
        reason: `Failed: ${errorMessage}`
      };
    }
  },
);
