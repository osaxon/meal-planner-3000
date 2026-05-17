import { and, eq, inArray } from "drizzle-orm";
import { meals, categories, mealTags } from "#/db/schema";
import type { AppDb } from "#/db/factory";
import type { MealWithCategory } from "./meals.zod";

const MEAL_PROJECTION = {
  id: meals.id,
  userId: meals.userId,
  name: meals.name,
  categoryId: meals.categoryId,
  categoryName: categories.name,
  diet: meals.diet,
  season: meals.season,
  producesLeftovers: meals.producesLeftovers,
  suitableFor: meals.suitableFor,
  dayAvailability: meals.dayAvailability,
  createdAt: meals.createdAt,
  updatedAt: meals.updatedAt,
};

/**
 * Fetch one or many Meals for a Household, including Category name and Tags.
 *
 * Pass `mealId` to retrieve a single Meal (returns empty array if not found).
 * Omit `mealId` to retrieve all Meals for the user, ordered by name.
 */
export async function queryMealsWithTags(
  db: AppDb,
  userId: string,
  options?: { mealId?: number },
): Promise<MealWithCategory[]> {
  const filter =
    options?.mealId !== undefined
      ? and(eq(meals.userId, userId), eq(meals.id, options.mealId))
      : eq(meals.userId, userId);

  const rows = await db
    .select(MEAL_PROJECTION)
    .from(meals)
    .innerJoin(categories, eq(meals.categoryId, categories.id))
    .where(filter)
    .orderBy(meals.name);

  if (rows.length === 0) return [];

  const tagRows = await db
    .select()
    .from(mealTags)
    .where(
      inArray(
        mealTags.mealId,
        rows.map((r) => r.id),
      ),
    );

  const tagsByMealId = new Map<number, string[]>();
  for (const t of tagRows) {
    const list = tagsByMealId.get(t.mealId) ?? [];
    list.push(t.tag);
    tagsByMealId.set(t.mealId, list);
  }

  return rows.map((r) => ({ ...r, tags: tagsByMealId.get(r.id) ?? [] }));
}
