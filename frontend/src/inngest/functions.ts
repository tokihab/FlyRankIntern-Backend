import { inngest } from "@/inngest/client";
import { completeExecution, failExecution } from "@/lib/execution-store";
import { runDecision } from "@/lib/llm";

export const runDecisionNode = inngest.createFunction(
  { 
    id: "run-decision-node", 
    retries: 3, 
    triggers: [{ event: "workflow/execute-node" }] 
  },
  async ({ event, step }) => {
    const { runId, nodeId, prompt } = event.data as { runId: string; nodeId: string; prompt: string };
    
    try {
      const result = await step.run("evaluate-decision", () => runDecision(prompt));
      
      const decisionResult = {
        ...result,
        runId,
        nodeId,
        decision: result.category === 'bug' || result.category === 'billing' ? 'YES' : 'NO',
        reason: result.reason || 'No reason provided',
      };
      
      completeExecution(runId, decisionResult);
      return decisionResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failExecution(runId, error);
      
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

// Report Generation Workflow
export const generateReportWorkflow = inngest.createFunction(
  { id: "generate-report-workflow", retries: 2, triggers: [{ event: "report/generate" }] },
  async ({ event, step }) => {
    const { type, filters = {}, reportId, force = false } = event.data as {
      type: string;
      filters?: Record<string, unknown>;
      reportId: string;
      force?: boolean;
    };

    try {
      // Step 1: Query data from Express API
      const prepareResult = await step.run("query-data", async () => {
        const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || "http://api:3000";
        const response = await fetch(`${backendUrl}/internal/reports/prepare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, filters, reportId }),
        });

        if (!response.ok) {
          throw new Error(`Failed to prepare report data: ${response.statusText}`);
        }

        return response.json();
      });

      // Step 2: Render and save PDF
      const renderResult = await step.run("render-and-save-pdf", async () => {
        const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || "http://api:3000";
        const response = await fetch(`${backendUrl}/internal/reports/render`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, filters, reportId }),
        });

        if (!response.ok) {
          throw new Error(`Failed to render PDF: ${response.statusText}`);
        }

        return response.json();
      });

      // Step 3: Finalize report
      await step.run("finalize-report", async () => {
        const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || "http://api:3000";
        const response = await fetch(`${backendUrl}/internal/reports/finalize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId }),
        });

        if (!response.ok) {
          throw new Error(`Failed to finalize report: ${response.statusText}`);
        }

        return response.json();
      });

      return { reportId, status: "completed", validRecords: renderResult.validRecords };
    } catch (error) {
      console.error("Report generation failed:", error);
      throw error;
    }
  },
);