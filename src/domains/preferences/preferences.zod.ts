import { z } from "zod";

const days = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Day = (typeof days)[number];

const mealTimeConfigSchema = z.object({
  lunch: z.boolean(),
  dinner: z.boolean(),
});

export const slotConfigSchema = z.object(
  Object.fromEntries(days.map((d) => [d, mealTimeConfigSchema])) as Record<
    Day,
    typeof mealTimeConfigSchema
  >,
);

export type SlotConfig = z.infer<typeof slotConfigSchema>;

export const defaultSlotConfig: SlotConfig = Object.fromEntries(
  days.map((d) => [d, { lunch: false, dinner: true }]),
) as SlotConfig;

export const preferencesSchema = z.object({
  slotConfig: slotConfigSchema,
  maxLeftoverMeals: z.number().int().min(0),
});

export const preferencesUpdateSchema = preferencesSchema.partial();

export type Preferences = z.infer<typeof preferencesSchema>;
export type PreferencesUpdate = z.infer<typeof preferencesUpdateSchema>;
