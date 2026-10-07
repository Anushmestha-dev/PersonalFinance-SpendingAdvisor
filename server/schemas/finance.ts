import { z } from 'zod';

export const AccountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["DEPOSITORY", "CREDIT", "INVESTMENT", "LOAN"]),
  balance: z.number(),
  currency: z.string().default("USD"),
});

export const CategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export const TransactionSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string().refine((str) => !isNaN(new Date(str).getTime()), "Invalid date").transform((str) => new Date(str)),
  description: z.string().optional(),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export const BudgetSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
  month: z.number().min(1).max(12),
  year: z.number().min(2000),
});

export const GoalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  targetAmount: z.number().positive(),
  savedAmount: z.number().min(0).default(0),
  deadline: z.string().refine((str) => !isNaN(new Date(str).getTime()), "Invalid date").transform((str) => new Date(str)),
});
