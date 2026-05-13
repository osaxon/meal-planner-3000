import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { schedules, slots } from "#/db/schema";

export const scheduleSelectSchema = createSelectSchema(schedules);
export const slotSelectSchema = createSelectSchema(slots);

export const scheduleWithSlotsSchema = scheduleSelectSchema.extend({
  slots: z.array(slotSelectSchema),
});

export const generateScheduleInputSchema = z.object({
  startDate: z.coerce.date(),
  durationWeeks: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  maxLeftoverMealsOverride: z.number().int().min(0).optional(),
});

export const shoppingListItemSchema = z.object({
  ingredientKey: z.string(),
  name: z.string(),
  totalQuantity: z.number().nullable(),
  unit: z.string().nullable(),
  checked: z.boolean(),
});

export const updateSlotInputSchema = z.object({
  slotId: z.number().int().positive(),
  mealId: z.number().int().positive().nullable(),
});

export type ShoppingListItem = z.infer<typeof shoppingListItemSchema>;
export type ScheduleWithSlots = z.infer<typeof scheduleWithSlotsSchema>;
export type GenerateScheduleInput = z.infer<typeof generateScheduleInputSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotInputSchema>;
export type Slot = z.infer<typeof slotSelectSchema>;
