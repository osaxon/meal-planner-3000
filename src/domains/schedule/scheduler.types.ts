import type { MealWithCategory } from "#/domains/meals/meals.zod";
import type { Preferences } from "#/domains/preferences/preferences.zod";

export type { MealWithCategory, Preferences };

export type ScheduleConfig = {
  startDate: Date;
  durationWeeks: 1 | 2 | 4;
  maxMeatMealsOverride?: number;
  maxFishMealsOverride?: number;
  maxLeftoverMealsOverride?: number;
};

export type SchedulerInput = {
  meals: MealWithCategory[];
  previousMealIds: number[];
  preferences: Preferences;
  config: ScheduleConfig;
};

export type GeneratedSlot = {
  date: Date;
  mealTime: "lunch" | "dinner";
  type: "filled" | "leftover" | "empty";
  mealId: number | null;
  /** For leftover slots: the index in the plan array of the source filled slot. */
  sourceSlotIndex: number | null;
};
