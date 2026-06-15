import { eq } from "drizzle-orm";
import { householdPreferences } from "#/db/schema";
import { noopCollector } from "#/lib/wide-event";
import { defaultSlotConfig, slotConfigSchema } from "./preferences.zod";
import type { AppDb } from "#/db/factory";
import type { EventCollector } from "#/lib/wide-event";
import type { Preferences, PreferencesUpdate, SlotConfig } from "./preferences.zod";

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
      maxLeftoverMeals: input.maxLeftoverMeals ?? current.maxLeftoverMeals,
    };

    const [row] = await this.db
      .insert(householdPreferences)
      .values({
        userId,
        slotConfig: JSON.stringify(merged.slotConfig),
        maxLeftoverMeals: merged.maxLeftoverMeals,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: householdPreferences.userId,
        set: {
          slotConfig: JSON.stringify(merged.slotConfig),
          maxLeftoverMeals: merged.maxLeftoverMeals,
          updatedAt: new Date(),
        },
      })
      .returning();

    this.events.addDetail("preferences.updated", { userId });
    return this.deserialize(row!);
  }

  private deserialize(row: typeof householdPreferences.$inferSelect): Preferences {
    return {
      slotConfig: parseSlotConfig(row.slotConfig),
      maxLeftoverMeals: row.maxLeftoverMeals,
    };
  }
}

/**
 * The single source of truth for Slot Configuration deserialization. Silently
 * falls back to defaults on malformed stored data — whether it is invalid JSON
 * or valid JSON that doesn't match the schema (#35).
 */
function parseSlotConfig(raw: string): SlotConfig {
  try {
    const parsed = slotConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : defaultSlotConfig;
  } catch {
    return defaultSlotConfig;
  }
}
