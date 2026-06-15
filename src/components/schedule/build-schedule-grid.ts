import { addDays, toDateKey, indexSlotsByDateAndTime } from "#/lib/date-utils";
import type { ScheduleWithSlots, Slot } from "#/domains/schedule/schedule.zod";

export const MEAL_TIMES = ["lunch", "dinner"] as const;
export type MealTime = (typeof MEAL_TIMES)[number];

export type GridCell = { day: Date; slot: Slot | undefined };
export type GridRow = { mealTime: MealTime; cells: GridCell[] };
export type ScheduleGrid = { days: Date[]; rows: GridRow[] };

/**
 * Build the week view of a Schedule: the seven days starting from `currentWeek`,
 * and a lunch/dinner row whose cells map each day to its Slot (or undefined).
 *
 * Pure — no rendering. Slot dates are coerced to `Date` for indexing because
 * they may arrive as strings after serialization over the wire.
 */
export function buildScheduleGrid(schedule: ScheduleWithSlots, currentWeek: number): ScheduleGrid {
  const weekStart = addDays(new Date(schedule.startDate), currentWeek * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const index = indexSlotsByDateAndTime(
    schedule.slots.map((s) => ({ ...s, date: new Date(s.date) })),
  );

  const rows: GridRow[] = MEAL_TIMES.map((mealTime) => ({
    mealTime,
    cells: days.map((day) => ({ day, slot: index.get(`${toDateKey(day)}|${mealTime}`) })),
  }));

  return { days, rows };
}
