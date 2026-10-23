import { z } from 'zod';

export const resortAnalysisSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  next5Days: z.string(),
  extended6to16: z.string(),
  modelAgreement: z.object({
    summary: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
  }),
  whatToWatch: z.string(),
});

export type ResortAnalysisOutput = z.infer<typeof resortAnalysisSchema>;

/** Resort ids and dates are enums, so the model can only pick real ones. */
export function rankingSchema(resortIds: [string, ...string[]], dates: [string, ...string[]]) {
  return z.object({
    bestResort: z.enum(resortIds),
    bestDay: z.enum(dates),
    summary: z.string(),
    ranking: z.array(
      z.object({
        resortId: z.enum(resortIds),
        day: z.enum(dates),
        reason: z.string(),
      }),
    ),
  });
}

export type RankingOutput = z.infer<ReturnType<typeof rankingSchema>>;
