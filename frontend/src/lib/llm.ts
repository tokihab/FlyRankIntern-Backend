import { outputSchema } from '@/lib/schema';

type TriageResult = {
  category: 'billing' | 'bug' | 'feature' | 'other';
  urgency: 'low' | 'normal' | 'high';
  confidence: number;
  reason: string;
};

export async function runDecision(prompt: string): Promise<TriageResult> {
  // This is a placeholder for the actual LLM decision logic
  // In production, this would call the backend API or a serverless function
  
  const response = await fetch('/api/backend/triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: prompt })
  });

  if (!response.ok) {
    throw new Error('Failed to run decision');
  }

  const result = await response.json();
  return outputSchema.parse(result);
}

export type { TriageResult };
