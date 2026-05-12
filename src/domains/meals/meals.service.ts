import { and, eq, inArray } from "drizzle-orm";
import { meals, categories, mealIngredients, mealTags } from "#/db/schema";
import { noopCollector } from "#/lib/wide-event";
import { ok, err } from "#/lib/result";
import type { AppDb } from "#/db/factory";
import type { EventCollector } from "#/lib/wide-event";
import type { Result, DomainError } from "#/lib/result";
import type {
  MealInsert,
  MealUpdate,
  MealWithCategory,
  Ingredient,
  IngredientInsert,
  IngredientUpdate,
} from "./meals.zod";

type NotFound = DomainError<"NOT_FOUND">;
type CategoryNotFound = DomainError<"CATEGORY_NOT_FOUND">;

type Name = "meals";

export class MealService {
  private readonly events: EventCollector<Name>;

  constructor(
    private readonly db: AppDb,
    events?: EventCollector<Name>,
  ) {
    this.events = events ?? noopCollector;
  }

  async list(userId: string): Promise<MealWithCategory[]> {
    const rows = await this.db
      .select({
        id: meals.id,
        userId: meals.userId,
        name: meals.name,
        categoryId: meals.categoryId,
        categoryName: categories.name,
        diet: meals.diet,
        season: meals.season,
        producesLeftovers: meals.producesLeftovers,
        suitableFor: meals.suitableFor,
        createdAt: meals.createdAt,
        updatedAt: meals.updatedAt,
      })
      .from(meals)
      .innerJoin(categories, eq(meals.categoryId, categories.id))
      .where(eq(meals.userId, userId))
      .orderBy(meals.name);

    if (rows.length === 0) return [];

    const tagRows = await this.db
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

  async findById(id: number, userId: string): Promise<MealWithCategory | null> {
    const [row] = await this.db
      .select({
        id: meals.id,
        userId: meals.userId,
        name: meals.name,
        categoryId: meals.categoryId,
        categoryName: categories.name,
        diet: meals.diet,
        season: meals.season,
        producesLeftovers: meals.producesLeftovers,
        suitableFor: meals.suitableFor,
        createdAt: meals.createdAt,
        updatedAt: meals.updatedAt,
      })
      .from(meals)
      .innerJoin(categories, eq(meals.categoryId, categories.id))
      .where(and(eq(meals.id, id), eq(meals.userId, userId)));
    if (!row) return null;

    const tagRows = await this.db.select().from(mealTags).where(eq(mealTags.mealId, id));
    return { ...row, tags: tagRows.map((t) => t.tag) };
  }

  async create(
    userId: string,
    input: MealInsert,
  ): Promise<Result<MealWithCategory, CategoryNotFound>> {
    const [category] = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId)));
    if (!category) {
      return err({ code: "CATEGORY_NOT_FOUND", message: `Category ${input.categoryId} not found` });
    }

    const [row] = await this.db
      .insert(meals)
      .values({ ...input, userId })
      .returning();
    this.events.addDetail("meals.created", { id: row!.id, name: row!.name });
    return ok({ ...row!, categoryName: category.name, tags: [], suitableFor: row!.suitableFor });
  }

  async update(
    id: number,
    userId: string,
    input: MealUpdate,
  ): Promise<Result<MealWithCategory, NotFound | CategoryNotFound>> {
    if (input.categoryId !== undefined) {
      const [category] = await this.db
        .select()
        .from(categories)
        .where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId)));
      if (!category) {
        return err({
          code: "CATEGORY_NOT_FOUND",
          message: `Category ${input.categoryId} not found`,
        });
      }
    }

    const [row] = await this.db
      .update(meals)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(meals.id, id), eq(meals.userId, userId)))
      .returning();
    if (!row) return err({ code: "NOT_FOUND", message: `Meal ${id} not found` });

    this.events.addDetail("meals.updated", { id });
    const withCategory = await this.findById(id, userId);
    return ok(withCategory!);
  }

  async delete(id: number, userId: string): Promise<Result<true, NotFound>> {
    const result = await this.db
      .delete(meals)
      .where(and(eq(meals.id, id), eq(meals.userId, userId)))
      .returning();
    if (result.length === 0) return err({ code: "NOT_FOUND", message: `Meal ${id} not found` });
    this.events.addDetail("meals.deleted", { id });
    return ok(true);
  }

  // ── Tags ────────────────────────────────────────────────────────────────────

  async setTags(id: number, userId: string, tags: string[]): Promise<Result<string[], NotFound>> {
    const meal = await this.findById(id, userId);
    if (!meal) return err({ code: "NOT_FOUND", message: `Meal ${id} not found` });

    await this.db.delete(mealTags).where(eq(mealTags.mealId, id));
    const unique = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
    if (unique.length > 0) {
      await this.db.insert(mealTags).values(unique.map((tag) => ({ mealId: id, tag })));
    }
    return ok(unique);
  }

  // ── Ingredients ─────────────────────────────────────────────────────────────

  async listIngredients(mealId: number, userId: string): Promise<Result<Ingredient[], NotFound>> {
    const meal = await this.findById(mealId, userId);
    if (!meal) return err({ code: "NOT_FOUND", message: `Meal ${mealId} not found` });
    const rows = await this.db
      .select()
      .from(mealIngredients)
      .where(eq(mealIngredients.mealId, mealId));
    return ok(rows);
  }

  async addIngredient(
    mealId: number,
    userId: string,
    input: IngredientInsert,
  ): Promise<Result<Ingredient, NotFound>> {
    const meal = await this.findById(mealId, userId);
    if (!meal) return err({ code: "NOT_FOUND", message: `Meal ${mealId} not found` });
    const [row] = await this.db
      .insert(mealIngredients)
      .values({ ...input, mealId })
      .returning();
    return ok(row!);
  }

  async updateIngredient(
    mealId: number,
    ingredientId: number,
    userId: string,
    input: IngredientUpdate,
  ): Promise<Result<Ingredient, NotFound>> {
    const meal = await this.findById(mealId, userId);
    if (!meal) return err({ code: "NOT_FOUND", message: `Ingredient ${ingredientId} not found` });
    const [row] = await this.db
      .update(mealIngredients)
      .set(input)
      .where(and(eq(mealIngredients.id, ingredientId), eq(mealIngredients.mealId, mealId)))
      .returning();
    if (!row) return err({ code: "NOT_FOUND", message: `Ingredient ${ingredientId} not found` });
    return ok(row);
  }

  async deleteIngredient(
    mealId: number,
    ingredientId: number,
    userId: string,
  ): Promise<Result<true, NotFound>> {
    const meal = await this.findById(mealId, userId);
    if (!meal) return err({ code: "NOT_FOUND", message: `Ingredient ${ingredientId} not found` });
    const result = await this.db
      .delete(mealIngredients)
      .where(and(eq(mealIngredients.id, ingredientId), eq(mealIngredients.mealId, mealId)))
      .returning();
    if (result.length === 0)
      return err({ code: "NOT_FOUND", message: `Ingredient ${ingredientId} not found` });
    return ok(true);
  }
}
