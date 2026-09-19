import { outputSchema } from '@/lib/schema';

type TriageResult = {
  category: 'billing' | 'bug' | 'feature' | 'other';
  urgency: 'low' | 'normal' | 'high';
  confidence: number;
  reason: string;
};

// Use the backend URL configured for container networking
const getBackendUrl = (): string => {
  // In container environment, use the service name
  if (typeof window === 'undefined') {
    // Server-side: use environment variable
    return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://api:3000';
  }
  // Client-side: use the public API URL
  return process.env.NEXT_PUBLIC_API_URL || '/api/backend';
};

export async function runDecision(prompt: string): Promise<TriageResult> {
  const backendUrl = getBackendUrl();
  
  const response = await fetch(`${backendUrl}/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: prompt }),
    // Add timeout via AbortController
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const result = await response.json();
  return outputSchema.parse(result);
}

export type { TriageResult };
