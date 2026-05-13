import { z } from "zod";

export const subjectTypeSchema = z.enum(["category", "tag", "diet"]);
export const operatorSchema = z.enum(["at_most", "at_least"]);
export const scopeSchema = z.enum(["per_schedule", "per_day"]);

const scopeField = { scope: scopeSchema.optional() };

export const ruleInsertSchema = z.discriminatedUnion("subjectType", [
  z.object({
    subjectType: z.literal("category"),
    categoryId: z.number().int().positive(),
    operator: operatorSchema,
    value: z.number().int().min(0),
    ...scopeField,
  }),
  z.object({
    subjectType: z.literal("tag"),
    subjectValue: z.string().min(1).max(100),
    operator: operatorSchema,
    value: z.number().int().min(0),
    ...scopeField,
  }),
  z.object({
    subjectType: z.literal("diet"),
    subjectValue: z.enum(["meat", "fish", "vegetarian"]),
    operator: operatorSchema,
    value: z.number().int().min(0),
    ...scopeField,
  }),
]);

export const ruleUpdateSchema = z.object({
  operator: operatorSchema.optional(),
  value: z.number().int().min(0).optional(),
  scope: scopeSchema.optional(),
});

export const ruleViewSchema = z.object({
  id: z.number(),
  userId: z.string(),
  subjectType: subjectTypeSchema,
  categoryId: z.number().nullable(),
  categoryName: z.string().nullable(),
  subjectValue: z.string().nullable(),
  operator: operatorSchema,
  value: z.number(),
  scope: scopeSchema,
  isContradicted: z.boolean(),
});

export type RuleInsert = z.infer<typeof ruleInsertSchema>;
export type RuleUpdate = z.infer<typeof ruleUpdateSchema>;
export type RuleView = z.infer<typeof ruleViewSchema>;

export const OPERATOR_LABELS: Record<RuleView["operator"], string> = {
  at_most: "At most",
  at_least: "At least",
};

export const SCOPE_LABELS: Record<RuleView["scope"], string> = {
  per_schedule: "Per schedule",
  per_day: "Per day",
};

export const DIET_SUBJECT_LABELS: Record<string, string> = {
  meat: "Meat",
  fish: "Fish",
  vegetarian: "Vegetarian",
};
