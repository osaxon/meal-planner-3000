import { and, eq, inArray } from "drizzle-orm";
import {
  schedules,
  slots,
  householdPreferences,
  mealIngredients,
  shoppingListChecks,
} from "#/db/schema";
import { queryMealsWithTags } from "#/domains/meals/meals.queries";
import { noopCollector } from "#/lib/wide-event";
import { SchedulerService } from "./scheduler.service";
import { slotConfigSchema, defaultSlotConfig } from "#/domains/preferences/preferences.zod";
import type { AppDb } from "#/db/factory";
import type { EventCollector } from "#/lib/wide-event";
import type {
  GenerateScheduleInput,
  ScheduleWithSlots,
  Slot,
  ShoppingListItem,
} from "./schedule.zod";
import type { DomainError, Result } from "#/lib/result";
import { ok, err } from "#/lib/result";

type Name = "schedule";

export class ScheduleService {
  private readonly scheduler = new SchedulerService();
  private readonly events: EventCollector<Name>;

  constructor(
    private readonly db: AppDb,
    events?: EventCollector<Name>,
  ) {
    this.events = events ?? noopCollector;
  }

  async generate(userId: string, input: GenerateScheduleInput): Promise<ScheduleWithSlots> {
    // 1. Fetch meal pool with tags
    const mealPool = await queryMealsWithTags(this.db, userId);

    // 2. Fetch previous schedule's filled slot meal IDs
    const [prevSchedule] = await this.db
      .select()
      .from(schedules)
      .where(and(eq(schedules.userId, userId), eq(schedules.status, "previous")));

    const previousMealIds: number[] = [];
    if (prevSchedule) {
      const prevSlots = await this.db
        .select({ mealId: slots.mealId })
        .from(slots)
        .where(and(eq(slots.scheduleId, prevSchedule.id), eq(slots.type, "filled")));
      for (const s of prevSlots) {
        if (s.mealId !== null) previousMealIds.push(s.mealId);
      }
    }

    // 3. Fetch preferences (upsert defaults if not exists)
    let [prefs] = await this.db
      .select()
      .from(householdPreferences)
      .where(eq(householdPreferences.userId, userId));

    if (!prefs) {
      [prefs] = await this.db.insert(householdPreferences).values({ userId }).returning();
    }

    const slotConfigParsed = slotConfigSchema.safeParse(JSON.parse(prefs!.slotConfig));
    const preferences = {
      slotConfig: slotConfigParsed.success ? slotConfigParsed.data : defaultSlotConfig,
      maxMeatMeals: prefs!.maxMeatMeals,
      maxFishMeals: prefs!.maxFishMeals,
      maxLeftoverMeals: prefs!.maxLeftoverMeals,
    };

    // 4. Run the scheduler
    const generatedSlots = this.scheduler.generate({
      meals: mealPool,
      previousMealIds,
      preferences,
      config: {
        startDate: input.startDate,
        durationWeeks: input.durationWeeks,
        maxMeatMealsOverride: input.maxMeatMealsOverride,
        maxFishMealsOverride: input.maxFishMealsOverride,
        maxLeftoverMealsOverride: input.maxLeftoverMealsOverride,
      },
    });

    // 5. Persist: discard old previous, promote active → previous, insert new
    const [existingActive] = await this.db
      .select()
      .from(schedules)
      .where(and(eq(schedules.userId, userId), eq(schedules.status, "active")));

    // Discard old previous (cascade deletes its slots)
    if (prevSchedule) {
      await this.db.delete(schedules).where(eq(schedules.id, prevSchedule.id));
    }

    // Promote active → previous
    if (existingActive) {
      await this.db
        .update(schedules)
        .set({ status: "previous" })
        .where(eq(schedules.id, existingActive.id));
    }

    // Insert new active schedule
    const [newSchedule] = await this.db
      .insert(schedules)
      .values({
        userId,
        status: "active",
        startDate: input.startDate,
        durationWeeks: input.durationWeeks,
        maxMeatMealsOverride: input.maxMeatMealsOverride ?? null,
        maxFishMealsOverride: input.maxFishMealsOverride ?? null,
        maxLeftoverMealsOverride: input.maxLeftoverMealsOverride ?? null,
      })
      .returning();

    // Insert all slots (leftover sourceSlotId = null initially)
    const insertedSlots =
      generatedSlots.length > 0
        ? await this.db
            .insert(slots)
            .values(
              generatedSlots.map((s) => ({
                scheduleId: newSchedule!.id,
                date: s.date,
                mealTime: s.mealTime,
                type: s.type,
                mealId: s.mealId ?? null,
                sourceSlotId: null,
              })),
            )
            .returning()
        : [];

    // Fix leftover sourceSlotId references
    const leftoverUpdates = generatedSlots
      .map((s, i) => ({ slot: s, idx: i }))
      .filter(({ slot }) => slot.type === "leftover" && slot.sourceSlotIndex !== null);

    for (const { slot, idx } of leftoverUpdates) {
      const sourceId = insertedSlots[slot.sourceSlotIndex!]?.id;
      if (sourceId !== undefined) {
        await this.db
          .update(slots)
          .set({ sourceSlotId: sourceId })
          .where(eq(slots.id, insertedSlots[idx]!.id));
        insertedSlots[idx] = { ...insertedSlots[idx]!, sourceSlotId: sourceId };
      }
    }

    this.events.addDetail("schedule.created", {
      id: newSchedule!.id,
      slots: generatedSlots.length,
    });
    return { ...newSchedule!, slots: insertedSlots };
  }

  async updateSlot(
    slotId: number,
    userId: string,
    mealId: number | null,
  ): Promise<Result<Slot, DomainError<"NOT_FOUND">>> {
    // Verify the slot belongs to the user's active schedule
    const [slot] = await this.db
      .select({ slot: slots, scheduleUserId: schedules.userId, scheduleStatus: schedules.status })
      .from(slots)
      .innerJoin(schedules, eq(slots.scheduleId, schedules.id))
      .where(
        and(eq(slots.id, slotId), eq(schedules.userId, userId), eq(schedules.status, "active")),
      );

    if (!slot) {
      return err({ code: "NOT_FOUND", message: `Slot ${slotId} not found in active schedule` });
    }

    const newType = mealId !== null ? "filled" : "empty";
    const [updated] = await this.db
      .update(slots)
      .set({ type: newType, mealId, sourceSlotId: null })
      .where(eq(slots.id, slotId))
      .returning();

    return ok(updated!);
  }

  async getActive(userId: string): Promise<ScheduleWithSlots | null> {
    const [schedule] = await this.db
      .select()
      .from(schedules)
      .where(and(eq(schedules.userId, userId), eq(schedules.status, "active")));

    if (!schedule) return null;

    const scheduleSlots = await this.db
      .select()
      .from(slots)
      .where(eq(slots.scheduleId, schedule.id));

    return { ...schedule, slots: scheduleSlots };
  }

  async getShoppingList(userId: string): Promise<ShoppingListItem[]> {
    const schedule = await this.getActive(userId);
    if (!schedule) return [];

    // Collect meal IDs from filled (non-leftover) slots only
    const filledMealIds = [
      ...new Set(
        schedule.slots
          .filter((s) => s.type === "filled" && s.mealId !== null)
          .map((s) => s.mealId as number),
      ),
    ];
    if (filledMealIds.length === 0) return [];

    // Fetch all ingredients for those meals
    const ingredients = await this.db
      .select()
      .from(mealIngredients)
      .where(inArray(mealIngredients.mealId, filledMealIds));

    // Aggregate by normalised name
    type Group = { name: string; items: (typeof mealIngredients.$inferSelect)[] };
    const groups = new Map<string, Group>();
    for (const ing of ingredients) {
      const key = ing.name.toLowerCase().trim();
      const g = groups.get(key) ?? { name: ing.name, items: [] };
      g.items.push(ing);
      groups.set(key, g);
    }

    // Fetch check-off state for this schedule
    const checks = await this.db
      .select()
      .from(shoppingListChecks)
      .where(eq(shoppingListChecks.scheduleId, schedule.id));
    const checkedKeys = new Set(checks.filter((c) => c.checked).map((c) => c.ingredientKey));

    return Array.from(groups.entries()).map(([key, { name, items }]) => {
      const units = new Set(items.map((i) => i.unit ?? null));
      const allSameUnit = units.size === 1;
      const unit = allSameUnit ? ([...units][0] ?? null) : null;
      const totalQuantity =
        allSameUnit && items.every((i) => i.quantity !== null)
          ? items.reduce((sum, i) => sum + (i.quantity ?? 0), 0)
          : null;

      return { ingredientKey: key, name, totalQuantity, unit, checked: checkedKeys.has(key) };
    });
  }

  async toggleShoppingItem(
    userId: string,
    ingredientKey: string,
  ): Promise<Result<ShoppingListItem, DomainError<"NOT_FOUND">>> {
    const schedule = await this.getActive(userId);
    if (!schedule) return err({ code: "NOT_FOUND", message: "No active schedule" });

    // Get current state (default false if not yet stored)
    const [existing] = await this.db
      .select()
      .from(shoppingListChecks)
      .where(
        and(
          eq(shoppingListChecks.scheduleId, schedule.id),
          eq(shoppingListChecks.ingredientKey, ingredientKey),
        ),
      );

    const newChecked = !(existing?.checked ?? false);

    await this.db
      .insert(shoppingListChecks)
      .values({ scheduleId: schedule.id, ingredientKey, checked: newChecked })
      .onConflictDoUpdate({
        target: [shoppingListChecks.scheduleId, shoppingListChecks.ingredientKey],
        set: { checked: newChecked },
      });

    // Return the updated item from the full list
    const list = await this.getShoppingList(userId);
    const item = list.find((i) => i.ingredientKey === ingredientKey);
    return ok(
      item ?? {
        ingredientKey,
        name: ingredientKey,
        totalQuantity: null,
        unit: null,
        checked: newChecked,
      },
    );
  }
}
