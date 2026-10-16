import { z } from 'zod';

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model', 'assistant']),
  content: z.string().min(1).max(2000),
});

export const ChatRequestSchema = z.object({
  question: z.string().trim().min(1, 'Question is required').max(1000, 'Question is too long'),
  history: z.array(ChatMessageSchema).optional().default([]),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
