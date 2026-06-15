import type { GenerateScheduleInput } from "#/domains/schedule/schedule.zod";

/** Raw string values held by the generate form's fields. */
export type GenerateFormValues = {
  startDate: string;
  durationWeeks: "1" | "2" | "4";
  maxLeftoverMealsOverride: string;
};

/**
 * Normalize the generate form's string values into the contract input:
 * coerce the date and duration, and drop the optional override when blank.
 * Pure — no side effects.
 */
export function normalizeGenerateInput(values: GenerateFormValues): GenerateScheduleInput {
  return {
    startDate: new Date(values.startDate),
    durationWeeks: Number(values.durationWeeks) as 1 | 2 | 4,
    maxLeftoverMealsOverride:
      values.maxLeftoverMealsOverride !== "" ? Number(values.maxLeftoverMealsOverride) : undefined,
  };
}
