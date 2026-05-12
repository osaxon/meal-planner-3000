import { and, eq, count } from "drizzle-orm";
import { categories, meals } from "#/db/schema";
import { noopCollector } from "#/lib/wide-event";
import { ok, err } from "#/lib/result";
import type { AppDb } from "#/db/factory";
import type { EventCollector } from "#/lib/wide-event";
import type { Result, DomainError } from "#/lib/result";
import type { Category, CategoryInsert } from "./categories.zod";

type NotFound = DomainError<"NOT_FOUND">;
type Duplicate = DomainError<"DUPLICATE">;
type HasMeals = DomainError<"HAS_MEALS">;

type Name = "categories";

export class CategoryService {
  private readonly events: EventCollector<Name>;

  constructor(
    private readonly db: AppDb,
    events?: EventCollector<Name>,
  ) {
    this.events = events ?? noopCollector;
  }

  async list(userId: string): Promise<Category[]> {
    return this.db.select().from(categories).where(eq(categories.userId, userId));
  }

  async findById(id: number, userId: string): Promise<Category | null> {
    const [row] = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)));
    return row ?? null;
  }

  async findByName(name: string, userId: string): Promise<Category | null> {
    const [row] = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.name, name), eq(categories.userId, userId)));
    return row ?? null;
  }

  async create(userId: string, input: CategoryInsert): Promise<Result<Category, Duplicate>> {
    const existing = await this.findByName(input.name, userId);
    if (existing) {
      return err({ code: "DUPLICATE", message: `Category "${input.name}" already exists` });
    }
    const [row] = await this.db
      .insert(categories)
      .values({ ...input, userId })
      .returning();
    this.events.addDetail("categories.created", { id: row!.id, name: row!.name });
    return ok(row!);
  }

  async rename(
    id: number,
    userId: string,
    name: string,
  ): Promise<Result<Category, NotFound | Duplicate>> {
    const existing = await this.findByName(name, userId);
    if (existing && existing.id !== id) {
      return err({ code: "DUPLICATE", message: `Category "${name}" already exists` });
    }
    const [row] = await this.db
      .update(categories)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning();
    if (!row) return err({ code: "NOT_FOUND", message: `Category ${id} not found` });
    this.events.addDetail("categories.updated", { id });
    return ok(row);
  }

  async delete(id: number, userId: string): Promise<Result<true, NotFound | HasMeals>> {
    const category = await this.findById(id, userId);
    if (!category) return err({ code: "NOT_FOUND", message: `Category ${id} not found` });

    const [{ mealCount }] = await this.db
      .select({ mealCount: count() })
      .from(meals)
      .where(eq(meals.categoryId, id));
    if (mealCount > 0) {
      return err({
        code: "HAS_MEALS",
        message: `Category "${category.name}" has ${mealCount} meal(s) and cannot be deleted`,
      });
    }

    await this.db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)));
    this.events.addDetail("categories.deleted", { id });
    return ok(true);
  }
}
