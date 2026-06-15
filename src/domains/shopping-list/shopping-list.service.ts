import { and, eq, inArray } from "drizzle-orm";
import { mealIngredients, shoppingListChecks } from "#/db/schema";
import { aggregateIngredients } from "./shopping-list.aggregator";
import { noopCollector } from "#/lib/wide-event";
import type { AppDb } from "#/db/factory";
import type { EventCollector } from "#/lib/wide-event";
import type { ScheduleWithSlots } from "#/domains/schedule/schedule.zod";
import type { ShoppingListItem } from "./shopping-list.zod";
import type { DomainError, Result } from "#/lib/result";
import { ok, err } from "#/lib/result";

type Name = "shopping-list";
type Events = "item_toggled";

type NotFound = DomainError<"NOT_FOUND">;

/**
 * The seam through which the Shopping List consumes the active Schedule's
 * Slots, instead of duplicating Schedule queries. Satisfied by ScheduleService.
 */
export type ActiveScheduleSource = {
  getActive(userId: string): Promise<ScheduleWithSlots | null>;
};

/** Meal IDs of the active Schedule's filled (non-Leftover) Slots, de-duplicated. */
function filledMealIds(schedule: ScheduleWithSlots): number[] {
  return [
    ...new Set(
      schedule.slots
        .filter((s) => s.type === "filled" && s.mealId !== null)
        .map((s) => s.mealId as number),
    ),
  ];
}

export class ShoppingListService {
  private readonly events: EventCollector<Name, Events>;

  constructor(
    private readonly db: AppDb,
    private readonly schedules: ActiveScheduleSource,
    events?: EventCollector<Name, Events>,
  ) {
    this.events = events ?? noopCollector;
  }

  /** Aggregated Ingredients across all filled Slots of the active Schedule. */
  async list(userId: string): Promise<ShoppingListItem[]> {
    const schedule = await this.schedules.getActive(userId);
    if (!schedule) return [];

    const mealIds = filledMealIds(schedule);
    if (mealIds.length === 0) return [];

    const ingredients = await this.db
      .select()
      .from(mealIngredients)
      .where(inArray(mealIngredients.mealId, mealIds));

    return aggregateIngredients(ingredients, await this.checkedKeys(schedule.id));
  }

  /**
   * Toggle the check-off state of one item and return just that item — without
   * re-aggregating the full list, so check-off feels instant.
   */
  async toggle(userId: string, ingredientKey: string): Promise<Result<ShoppingListItem, NotFound>> {
    const schedule = await this.schedules.getActive(userId);
    if (!schedule) return err({ code: "NOT_FOUND", message: "No active schedule" });

    const [existing] = await this.db
      .select()
      .from(shoppingListChecks)
      .where(
        and(
          eq(shoppingListChecks.scheduleId, schedule.id),
          eq(shoppingListChecks.ingredientKey, ingredientKey),
        ),
      );

    const checked = !(existing?.checked ?? false);

    await this.db
      .insert(shoppingListChecks)
      .values({ scheduleId: schedule.id, ingredientKey, checked })
      .onConflictDoUpdate({
        target: [shoppingListChecks.scheduleId, shoppingListChecks.ingredientKey],
        set: { checked },
      });

    this.events.addDetail("shopping-list.item_toggled", { ingredientKey, checked });

    // Recompute only the toggled item from its own Ingredient rows.
    const mealIds = filledMealIds(schedule);
    const ingredients = mealIds.length
      ? await this.db.select().from(mealIngredients).where(inArray(mealIngredients.mealId, mealIds))
      : [];
    const matching = ingredients.filter((i) => i.name.toLowerCase().trim() === ingredientKey);
    const [item] = aggregateIngredients(matching, checked ? new Set([ingredientKey]) : new Set());

    return ok(
      item ?? { ingredientKey, name: ingredientKey, totalQuantity: null, unit: null, checked },
    );
  }

  /** ingredientKeys checked off for a Schedule. */
  private async checkedKeys(scheduleId: number): Promise<Set<string>> {
    const checks = await this.db
      .select()
      .from(shoppingListChecks)
      .where(eq(shoppingListChecks.scheduleId, scheduleId));
    return new Set(checks.filter((c) => c.checked).map((c) => c.ingredientKey));
  }
}
