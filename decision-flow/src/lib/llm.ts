import OpenAI from "openai";
import { z } from "zod";

export const decisionSchema = z.object({
  decision: z.enum(["YES", "NO"]),
  reason: z.string().min(1),
});

export type DecisionResult = z.infer<typeof decisionSchema>;

type LlmUsage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
type ChatResponse = { choices?: Array<{ message?: { content?: string | null } }>; usage?: LlmUsage };

const timeoutMs = 30_000;
const maxAttempts = 3;

function mockDecision(prompt: string): DecisionResult {
  const normalized = prompt.toLowerCase();
  const negativeSignals = ["not", "no", "exclude", "skip", "spam", "unrelated"];
  const decision = negativeSignals.some((signal) => normalized.includes(signal)) ? "NO" : "YES";
  return { decision, reason: `Mock decision: ${decision} based on deterministic keyword evaluation.` };
}

function isRetryable(error: unknown): boolean {
  const candidate = error as { status?: number; code?: string; name?: string; cause?: { code?: string } };
  const status = Number(candidate?.status ?? 0);
  return status === 429 || (status >= 500 && status <= 599) || candidate?.name === "APIConnectionError" || ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(candidate?.code ?? candidate?.cause?.code ?? "");
}

function parseContent(content: string | null | undefined): unknown {
  if (!content) throw new Error("LLM returned an empty response");
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  return JSON.parse((fenced ?? content).trim());
}

async function requestModel(client: OpenAI, prompt: string, repairMessage?: string): Promise<ChatResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await client.chat.completions.create({
      model: process.env.LLM_MODEL ?? "openai/gpt-oss-120b",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return JSON only. The exact shape is {\"decision\":\"YES\"|\"NO\",\"reason\":string}." },
        { role: "user", content: repairMessage ? `Repair this invalid output. Zod error: ${repairMessage}. Original task: ${prompt}` : prompt },
      ],
    }, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function runDecision(prompt: string): Promise<DecisionResult> {
  const startedAt = Date.now();
  if (process.env.LLM_ENABLED !== "true") {
    const result = mockDecision(prompt);
    console.log(JSON.stringify({ event: "llm.cost", mode: "mock", tokens: 0, durationMs: Date.now() - startedAt, repairCount: 0 }));
    return result;
  }

  const client = new OpenAI({ apiKey: process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL, timeout: timeoutMs, maxRetries: 0 });
  let repairCount = 0;
  let lastError: unknown;
  let usage: LlmUsage | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await requestModel(client, prompt);
      usage = response.usage;
      const parsed = decisionSchema.parse(parseContent(response.choices?.[0]?.message?.content));
      console.log(JSON.stringify({ event: "llm.cost", mode: "live", tokens: usage?.total_tokens ?? 0, promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0, durationMs: Date.now() - startedAt, repairCount }));
      return parsed;
    } catch (error) {
      lastError = error;
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        if (repairCount === 0) {
          repairCount += 1;
          try {
            const repairResponse = await requestModel(client, prompt, error instanceof z.ZodError ? error.message : "Output was not valid JSON");
            usage = repairResponse.usage ?? usage;
            const repaired = decisionSchema.parse(parseContent(repairResponse.choices?.[0]?.message?.content));
            console.log(JSON.stringify({ event: "llm.cost", mode: "live", tokens: usage?.total_tokens ?? 0, promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0, durationMs: Date.now() - startedAt, repairCount }));
            return repaired;
          } catch (repairError) {
            lastError = repairError;
          }
        }
        break;
      }
      if (!isRetryable(error) || attempt === maxAttempts - 1) break;
      console.error(JSON.stringify({ event: "llm.retry", attempt: attempt + 1, error: error instanceof Error ? error.message : String(error) }));
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }

  console.log(JSON.stringify({ event: "llm.cost", mode: "live", tokens: usage?.total_tokens ?? 0, promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0, durationMs: Date.now() - startedAt, repairCount, failed: true }));
  throw new Error(`LLM decision failed: ${lastError instanceof Error ? lastError.message : "unknown error"}`);
}
