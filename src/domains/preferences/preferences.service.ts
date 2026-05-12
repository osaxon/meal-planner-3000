import { eq } from "drizzle-orm";
import { householdPreferences } from "#/db/schema";
import { noopCollector } from "#/lib/wide-event";
import { defaultSlotConfig, slotConfigSchema } from "./preferences.zod";
import type { AppDb } from "#/db/factory";
import type { EventCollector } from "#/lib/wide-event";
import type { Preferences, PreferencesUpdate } from "./preferences.zod";

type Name = "preferences";

export class PreferencesService {
  private readonly events: EventCollector<Name>;

  constructor(
    private readonly db: AppDb,
    events?: EventCollector<Name>,
  ) {
    this.events = events ?? noopCollector;
  }

  async get(userId: string): Promise<Preferences> {
    const [row] = await this.db
      .select()
      .from(householdPreferences)
      .where(eq(householdPreferences.userId, userId));

    if (row) return this.deserialize(row);

    const [created] = await this.db.insert(householdPreferences).values({ userId }).returning();

    return this.deserialize(created!);
  }

  async update(userId: string, input: PreferencesUpdate): Promise<Preferences> {
    const current = await this.get(userId);

    const merged: Preferences = {
      slotConfig: input.slotConfig ?? current.slotConfig,
      maxMeatMeals: input.maxMeatMeals ?? current.maxMeatMeals,
      maxFishMeals: input.maxFishMeals ?? current.maxFishMeals,
      maxLeftoverMeals: input.maxLeftoverMeals ?? current.maxLeftoverMeals,
    };

    const [row] = await this.db
      .insert(householdPreferences)
      .values({
        userId,
        slotConfig: JSON.stringify(merged.slotConfig),
        maxMeatMeals: merged.maxMeatMeals,
        maxFishMeals: merged.maxFishMeals,
        maxLeftoverMeals: merged.maxLeftoverMeals,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: householdPreferences.userId,
        set: {
          slotConfig: JSON.stringify(merged.slotConfig),
          maxMeatMeals: merged.maxMeatMeals,
          maxFishMeals: merged.maxFishMeals,
          maxLeftoverMeals: merged.maxLeftoverMeals,
          updatedAt: new Date(),
        },
      })
      .returning();

    this.events.addDetail("preferences.updated", { userId });
    return this.deserialize(row!);
  }

  private deserialize(row: typeof householdPreferences.$inferSelect): Preferences {
    const parsed = slotConfigSchema.safeParse(JSON.parse(row.slotConfig));
    return {
      slotConfig: parsed.success ? parsed.data : defaultSlotConfig,
      maxMeatMeals: row.maxMeatMeals,
      maxFishMeals: row.maxFishMeals,
      maxLeftoverMeals: row.maxLeftoverMeals,
    };
  }
}
