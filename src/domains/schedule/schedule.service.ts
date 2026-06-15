import { and, eq, inArray, sql } from "drizzle-orm";
import {
  schedules,
  slots,
  householdPreferences,
  mealIngredients,
  shoppingListChecks,
  schedulingRules,
} from "#/db/schema";
import { queryMealsWithTags } from "#/domains/meals/meals.queries";
import { aggregateIngredients } from "./shopping-list.aggregator";
import { promoteAndInsertSchedule } from "./schedule-lifecycle";
import { resolveLeftoverReferences } from "./leftover-resolver";
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
      maxLeftoverMeals: prefs!.maxLeftoverMeals,
    };

    // 4. Fetch Scheduling Rules
    const rules = await this.db
      .select()
      .from(schedulingRules)
      .where(eq(schedulingRules.userId, userId));

    // 5. Run the scheduler
    const generatedSlots = this.scheduler.generate({
      meals: mealPool,
      previousMealIds,
      preferences,
      config: {
        startDate: input.startDate,
        durationWeeks: input.durationWeeks,
        maxLeftoverMealsOverride: input.maxLeftoverMealsOverride,
      },
      rules,
    });

    // 6. Persist atomically (#33): discard old previous → promote active →
    //    insert Schedule → insert Slots → resolve Leftover references, all in
    //    one transaction so a mid-sequence failure leaves the household's
    //    active and previous Schedules exactly as they were.
    const { newSchedule, insertedSlots } = await this.db.transaction(async (tx) => {
      const [existingActive] = await tx
        .select()
        .from(schedules)
        .where(and(eq(schedules.userId, userId), eq(schedules.status, "active")));

      const newSchedule = await promoteAndInsertSchedule({
        tx,
        userId,
        prevScheduleId: prevSchedule?.id ?? null,
        existingActiveId: existingActive?.id ?? null,
        newScheduleValues: { userId, ...input },
      });

      // Insert all slots (leftover sourceSlotId = null initially)
      const insertedSlots =
        generatedSlots.length > 0
          ? await tx
              .insert(slots)
              .values(
                generatedSlots.map((s) => ({
                  scheduleId: newSchedule.id,
                  date: s.date,
                  mealTime: s.mealTime,
                  type: s.type,
                  mealId: s.mealId ?? null,
                  sourceSlotId: null,
                })),
              )
              .returning()
          : [];

      // Resolve leftover sourceSlotId references in a single batched UPDATE
      // (one CASE statement) rather than one update per Leftover Slot.
      const leftoverRefs = resolveLeftoverReferences(
        generatedSlots,
        insertedSlots.map((s) => s.id),
      );

      if (leftoverRefs.length > 0) {
        const cases = sql.join(
          leftoverRefs.map((r) => sql`when ${r.leftoverDbId} then ${r.sourceSlotId}`),
          sql.raw(" "),
        );
        await tx
          .update(slots)
          .set({ sourceSlotId: sql`case ${slots.id} ${cases} end` })
          .where(
            inArray(
              slots.id,
              leftoverRefs.map((r) => r.leftoverDbId),
            ),
          );

        const sourceById = new Map(leftoverRefs.map((r) => [r.leftoverDbId, r.sourceSlotId]));
        for (let i = 0; i < insertedSlots.length; i++) {
          const sourceSlotId = sourceById.get(insertedSlots[i]!.id);
          if (sourceSlotId !== undefined) {
            insertedSlots[i] = { ...insertedSlots[i]!, sourceSlotId };
          }
        }
      }

      return { newSchedule, insertedSlots };
    });

    this.events.addDetail("schedule.created", {
      id: newSchedule.id,
      slots: generatedSlots.length,
    });
    return { ...newSchedule, slots: insertedSlots };
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

    // Orphan any leftover slots that derived from this slot — leftovers can only
    // exist if the source meal is actually being cooked.
    await this.db
      .update(slots)
      .set({ type: "empty", mealId: null, sourceSlotId: null })
      .where(eq(slots.sourceSlotId, slotId));

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

    // Fetch check-off state for this schedule
    const checks = await this.db
      .select()
      .from(shoppingListChecks)
      .where(eq(shoppingListChecks.scheduleId, schedule.id));
    const checkedKeys = new Set(checks.filter((c) => c.checked).map((c) => c.ingredientKey));

    return aggregateIngredients(ingredients, checkedKeys);
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
