import type { MealWithCategory } from "#/domains/meals/meals.zod";
import type { Preferences } from "#/domains/preferences/preferences.zod";

export type { MealWithCategory, Preferences };

export type ScheduleConfig = {
  startDate: Date;
  durationWeeks: 1 | 2 | 4;
  maxLeftoverMealsOverride?: number;
};

/** Minimal Rule representation used by the Scheduler — no UI or DB concerns. */
export type SchedulingRule = {
  subjectType: "category" | "tag" | "diet";
  categoryId: number | null;
  subjectValue: string | null;
  operator: "at_most" | "at_least";
  value: number;
  scope: "per_schedule" | "per_day";
};

export type SchedulerInput = {
  meals: MealWithCategory[];
  previousMealIds: number[];
  preferences: Preferences;
  config: ScheduleConfig;
  rules: SchedulingRule[];
  /** Random source in [0, 1) used to shuffle the meal pool. Defaults to Math.random. */
  rng?: () => number;
};

export type GeneratedSlot = {
  date: Date;
  mealTime: "lunch" | "dinner";
  type: "filled" | "leftover" | "empty";
  mealId: number | null;
  /** For leftover slots: the index in the plan array of the source filled slot. */
  sourceSlotIndex: number | null;
};
