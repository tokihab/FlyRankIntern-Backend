import { z } from 'zod';

export const outputSchema = z.object({
  category: z.enum(['billing', 'bug', 'feature', 'other']),
  urgency: z.enum(['low', 'normal', 'high']),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(200)
});

export type TriageResult = z.infer<typeof outputSchema>;
