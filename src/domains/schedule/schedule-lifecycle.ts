import { and, eq } from "drizzle-orm";
import { schedules } from "#/db/schema";
import type { AppDb } from "#/db/factory";

type NewScheduleValues = {
  userId: string;
  startDate: Date;
  durationWeeks: number;
  maxMeatMealsOverride?: number | null;
  maxFishMealsOverride?: number | null;
  maxLeftoverMealsOverride?: number | null;
};

type LifecycleInput = {
  db: AppDb;
  userId: string;
  /** ID of the existing previous Schedule to discard, or null if none exists. */
  prevScheduleId: number | null;
  /** ID of the existing active Schedule to promote to previous, or null if none exists. */
  existingActiveId: number | null;
  newScheduleValues: NewScheduleValues;
};

/**
 * Promote the active Schedule to previous, discard the old previous, and
 * insert the new active Schedule. Returns the newly inserted Schedule record.
 *
 * Steps (in order):
 * 1. Delete the old previous Schedule (cascade removes its Slots and ShoppingListChecks).
 * 2. Promote the current active Schedule to status "previous".
 * 3. Insert and return the new active Schedule.
 */
export async function promoteAndInsertSchedule(
  input: LifecycleInput,
): Promise<typeof schedules.$inferSelect> {
  const { db, userId, prevScheduleId, existingActiveId, newScheduleValues } = input;

  if (prevScheduleId !== null) {
    await db.delete(schedules).where(eq(schedules.id, prevScheduleId));
  }

  if (existingActiveId !== null) {
    await db
      .update(schedules)
      .set({ status: "previous" })
      .where(and(eq(schedules.id, existingActiveId), eq(schedules.userId, userId)));
  }

  const [newSchedule] = await db
    .insert(schedules)
    .values({
      userId,
      status: "active",
      startDate: newScheduleValues.startDate,
      durationWeeks: newScheduleValues.durationWeeks,
      maxMeatMealsOverride: newScheduleValues.maxMeatMealsOverride ?? null,
      maxFishMealsOverride: newScheduleValues.maxFishMealsOverride ?? null,
      maxLeftoverMealsOverride: newScheduleValues.maxLeftoverMealsOverride ?? null,
    })
    .returning();

  return newSchedule!;
}
