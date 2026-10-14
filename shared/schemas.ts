/**
 * Antra — zod schemas shared by the client forms and the Worker API. One source
 * of truth for validation on both sides of the wire.
 */

import { z } from 'zod'

const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: 'Invalid date-time',
})

export const accountTypeSchema = z.enum(['bank', 'credit_card'])
export const themeSchema = z.enum(['system', 'light', 'dark'])
export const sourceSchema = z.enum(['app', 'api'])
export const hexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a hex colour')

export const accountInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(60),
    type: accountTypeSchema,
    last4: z
      .string()
      .trim()
      .regex(/^\d{0,4}$/, 'Last 4 must be digits')
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    color: hexColorSchema.default('#0A84FF'),
    icon: z.string().trim().max(8).default('🏦'),
    credit_limit_minor: z.number().int().nonnegative().nullable().optional(),
    statement_day: z.number().int().min(1).max(31).nullable().optional(),
    due_day: z.number().int().min(1).max(31).nullable().optional(),
    archived: z.number().int().min(0).max(1).optional(),
    sort_order: z.number().int().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'credit_card' && val.credit_limit_minor != null && val.credit_limit_minor <= 0) {
      ctx.addIssue({ code: 'custom', path: ['credit_limit_minor'], message: 'Credit limit must be positive' })
    }
  })

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(40),
  emoji: z.string().trim().min(1).max(8),
  color: hexColorSchema.default('#8A8F98'),
  sort_order: z.number().int().optional(),
})

export const expenseInputSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  amount_minor: z.number().int().positive('Amount must be greater than zero'),
  category_id: z.string().min(1),
  account_id: z.string().min(1),
  merchant: z.string().trim().max(80).nullable().optional(),
  note: z.string().trim().max(280).nullable().optional(),
  spent_at: isoDateTime.optional(),
  paid: z.number().int().min(0).max(1).optional(),
  source: sourceSchema.optional(),
})

export const budgetInputSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  category_id: z.string().min(1),
  amount_minor: z.number().int().nonnegative(),
  period: z.literal('monthly').default('monthly'),
})

export const settingsInputSchema = z.object({
  currency: z.string().trim().length(3).toUpperCase(),
  theme: themeSchema.default('system'),
  timezone: z.string().trim().min(1).max(64).default('Asia/Kolkata'),
  week_start: z.number().int().min(0).max(6).default(1),
})

/** Wire payloads for the delta-push endpoints. */
export const pushPayloadSchema = z.object({
  accounts: z.array(z.record(z.string(), z.unknown())).default([]),
  categories: z.array(z.record(z.string(), z.unknown())).default([]),
  expenses: z.array(z.record(z.string(), z.unknown())).default([]),
  budgets: z.array(z.record(z.string(), z.unknown())).default([]),
  settings: z.array(z.record(z.string(), z.unknown())).default([]),
})

export const authSetupSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
  name: z.string().trim().min(1, 'Name is required').max(60),
})

export const authLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
})

export const apiTokenCreateSchema = z.object({
  name: z.string().trim().min(1, 'Give the token a name').max(60),
})

/** Public API v1 — expense create. `amount` is in MAJOR units. */
export const apiExpenseCreateSchema = z.object({
  amount: z.union([z.number().positive(), z.string().min(1)]),
  category: z.string().trim().min(1).optional(),
  account: z.string().trim().min(1).optional(),
  merchant: z.string().trim().max(80).optional(),
  note: z.string().trim().max(280).optional(),
  date: z.string().trim().optional(),
  paid: z.union([z.boolean(), z.number()]).optional(),
  create_missing: z.boolean().optional(),
  idempotency_key: z.string().trim().max(120).optional(),
})

export type AccountInput = z.input<typeof accountInputSchema>
export type CategoryInput = z.input<typeof categoryInputSchema>
export type ExpenseInput = z.input<typeof expenseInputSchema>
export type BudgetInput = z.input<typeof budgetInputSchema>
export type SettingsInput = z.input<typeof settingsInputSchema>
export type ApiExpenseCreate = z.infer<typeof apiExpenseCreateSchema>
