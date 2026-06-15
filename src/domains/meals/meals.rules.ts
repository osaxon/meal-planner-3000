import type { Meal } from "./meals.zod";

/**
 * Maps each dayAvailability preset to a predicate that returns true if a meal
 * may be placed as a Filled Slot on the given date.
 *
 * To add a new preset: extend the Meal["dayAvailability"] enum in the schema
 * and add one entry here. No Scheduler logic changes are required.
 */
export const DAY_AVAILABILITY_PREDICATES: Record<Meal["dayAvailability"], (date: Date) => boolean> =
  {
    any: () => true,
    weekdays_only: (date) => {
      const day = date.getUTCDay();
      return day >= 1 && day <= 5;
    },
    weekends_only: (date) => {
      const day = date.getUTCDay();
      return day === 0 || day === 6;
    },
  };
