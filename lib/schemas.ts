import { z } from 'zod';

const timestampPattern = /^(?:\d{1,2}:)?\d{1,2}:\d{1,2}$/;
// Strict [MM:SS-MM:SS] or [HH:MM:SS-HH:MM:SS] range, brackets required
const timestampRangePattern = /^\[(?:\d{1,2}:)?\d{1,2}:\d{1,2}-(?:\d{1,2}:)?\d{1,2}:\d{1,2}\]$/;

export const topicQuoteSchema = z.object({
  // Enforce a strict bracketed timestamp range to improve provider compliance
  timestamp: z.string().regex(timestampRangePattern),
  text: z.string().max(20000)
});

export const topicGenerationSchema = z.array(
  z.object({
    title: z.string().max(2000),
    quote: topicQuoteSchema.optional()
  })
);

export const suggestedQuestionsSchema = z.array(z.string());

export const chatResponseSchema = z.object({
  answer: z.string().max(100000),
  timestamps: z.array(z.string().regex(timestampPattern)).max(5).optional()
});

export const summaryTakeawaySchema = z.object({
  label: z.string().min(1).max(2000),
  insight: z.string().min(1).max(10000),
  timestamps: z.array(z.string().regex(timestampPattern)).min(1).max(2)
});

// For OpenAI structured outputs, we need to wrap arrays in objects
// because OpenAI only supports type: "object" at the root level
export const summaryTakeawaysWrapperSchema = z.object({
  takeaways: z.array(summaryTakeawaySchema).min(4).max(6)
});

// Keep the original for compatibility with non-OpenAI providers
export const summaryTakeawaysSchema = z.array(summaryTakeawaySchema).min(4).max(6);

export const quickPreviewSchema = z.object({
  overview: z.string().min(1).max(30000)
});

export const topQuoteSchema = z.object({
  title: z.string().min(1),
  quote: z.string().min(1).max(20000),
  timestamp: z.string().regex(timestampPattern)
});

// For OpenAI structured outputs, we need to wrap arrays in objects
export const topQuotesWrapperSchema = z.object({
  quotes: z.array(topQuoteSchema).min(1).max(5)
});

// Keep the original for compatibility with non-OpenAI providers
export const topQuotesSchema = z.array(topQuoteSchema).min(1).max(5);
