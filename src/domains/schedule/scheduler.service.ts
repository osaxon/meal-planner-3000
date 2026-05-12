import type { Day } from "#/domains/preferences/preferences.zod";
import type {
  MealWithCategory,
  SchedulerInput,
  GeneratedSlot,
  ScheduleConfig,
} from "./scheduler.types";

// ── Season detection ─────────────────────────────────────────────────────────

const ELIGIBLE_SEASONS: Record<number, Set<MealWithCategory["season"]>> = {
  1: new Set(["year_round", "autumn_winter"]),
  2: new Set(["year_round", "autumn_winter"]),
  3: new Set(["year_round", "autumn_winter"]),
  4: new Set(["year_round", "spring_summer"]),
  5: new Set(["year_round", "spring_summer"]),
  6: new Set(["year_round", "spring_summer"]),
  7: new Set(["year_round", "spring_summer"]),
  8: new Set(["year_round", "spring_summer"]),
  9: new Set(["year_round", "spring_summer"]),
  10: new Set(["year_round", "autumn_winter"]),
  11: new Set(["year_round", "autumn_winter"]),
  12: new Set(["year_round", "autumn_winter", "festive"]),
};

export function getEligibleSeasons(date: Date): Set<MealWithCategory["season"]> {
  return ELIGIBLE_SEASONS[date.getMonth() + 1]!;
}

// ── Slot generation ──────────────────────────────────────────────────────────

const DAY_NAMES: Day[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function generateSlotFrames(
  config: ScheduleConfig,
  slotConfig: SchedulerInput["preferences"]["slotConfig"],
): Array<{ date: Date; mealTime: "lunch" | "dinner" }> {
  const frames: Array<{ date: Date; mealTime: "lunch" | "dinner" }> = [];
  const totalDays = config.durationWeeks * 7;

  for (let offset = 0; offset < totalDays; offset++) {
    const date = new Date(config.startDate);
    date.setDate(date.getDate() + offset);

    const dayName = DAY_NAMES[date.getDay()]!;
    const dayConfig = slotConfig[dayName];

    if (dayConfig.lunch) frames.push({ date, mealTime: "lunch" });
    if (dayConfig.dinner) frames.push({ date, mealTime: "dinner" });
  }

  return frames;
}

// ── Meal selection ────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function pickMeal(
  pool: MealWithCategory[],
  usedIds: Set<number>,
  mealTime: "lunch" | "dinner",
  meatCount: number,
  maxMeat: number,
  fishCount: number,
  maxFish: number,
): MealWithCategory | null {
  return (
    pool.find(
      (m) =>
        !usedIds.has(m.id) &&
        (m.diet !== "meat" || meatCount < maxMeat) &&
        (m.diet !== "fish" || fishCount < maxFish) &&
        (m.suitableFor === "any" || m.suitableFor === mealTime),
    ) ?? null
  );
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function isoDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nextCalendarDayKey(date: Date): string {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return isoDateKey(next);
}

// ── Core algorithm ────────────────────────────────────────────────────────────

export class SchedulerService {
  generate(input: SchedulerInput): GeneratedSlot[] {
    const { meals, previousMealIds, preferences, config } = input;

    // 1. Generate enabled slot frames
    const frames = generateSlotFrames(config, preferences.slotConfig);
    if (frames.length === 0) return [];

    // 2. Initialise result with empty slots
    const result: GeneratedSlot[] = frames.map((f) => ({
      ...f,
      type: "empty",
      mealId: null,
      sourceSlotIndex: null,
    }));

    // 3. Effective constraints (per-schedule overrides take precedence)
    const maxMeat = config.maxMeatMealsOverride ?? preferences.maxMeatMeals;
    const maxFish = config.maxFishMealsOverride ?? preferences.maxFishMeals;
    const maxLeftovers = config.maxLeftoverMealsOverride ?? preferences.maxLeftoverMeals;

    // 4. Filter eligible meals: no BBQ, season matches, not in previous schedule
    const eligibleSeasons = getEligibleSeasons(config.startDate);
    const previousIds = new Set(previousMealIds);

    const eligibleMeals = meals.filter(
      (m) => m.season !== "bbq" && eligibleSeasons.has(m.season) && !previousIds.has(m.id),
    );

    if (eligibleMeals.length === 0) return result;

    // 5. Shuffle for variety, then fill slots
    const pool = shuffle(eligibleMeals);
    const usedIds = new Set<number>();
    let meatCount = 0;
    let fishCount = 0;
    let leftoverCount = 0;

    for (let i = 0; i < result.length; i++) {
      const slot = result[i]!;
      if (slot.type !== "empty") continue; // already assigned as leftover

      // Try to pick an eligible, unused meal that suits this slot's meal time
      let meal = pickMeal(pool, usedIds, slot.mealTime, meatCount, maxMeat, fishCount, maxFish);

      // If all meals are used, reset uniqueness and try again (handles small pools)
      if (!meal && usedIds.size > 0) {
        usedIds.clear();
        meal = pickMeal(pool, usedIds, slot.mealTime, meatCount, maxMeat, fishCount, maxFish);
      }

      if (!meal) continue; // diet quotas exhausted — leave empty

      // Assign the meal
      result[i] = { ...slot, type: "filled", mealId: meal.id };
      usedIds.add(meal.id);
      if (meal.diet === "meat") meatCount++;
      if (meal.diet === "fish") fishCount++;

      // Place a leftover slot if applicable
      if (meal.producesLeftovers && leftoverCount < maxLeftovers) {
        const leftoverIdx = this.findLeftoverSlot(result, i);
        if (leftoverIdx !== -1) {
          result[leftoverIdx] = {
            ...result[leftoverIdx]!,
            type: "leftover",
            mealId: meal.id,
            sourceSlotIndex: i,
          };
          leftoverCount++;
        }
      }
    }

    return result;
  }

  private findLeftoverSlot(result: GeneratedSlot[], fromIndex: number): number {
    const source = result[fromIndex]!;

    // For dinner slots: prefer next calendar day's lunch, then next calendar day's dinner.
    // Leftover eligibility is not constrained by the source meal's suitableFor (ADR 0002).
    if (source.mealTime === "dinner") {
      const nextDayKey = nextCalendarDayKey(source.date);
      for (const targetTime of ["lunch", "dinner"] as const) {
        const idx = result.findIndex(
          (s, i) =>
            i > fromIndex &&
            s.type === "empty" &&
            s.mealTime === targetTime &&
            isoDateKey(s.date) === nextDayKey,
        );
        if (idx !== -1) return idx;
      }
    }

    // Fallback: prefer i+2 over i+1
    for (const offset of [2, 1]) {
      const idx = fromIndex + offset;
      if (idx < result.length && result[idx]!.type === "empty") return idx;
    }
    return -1;
  }
}
