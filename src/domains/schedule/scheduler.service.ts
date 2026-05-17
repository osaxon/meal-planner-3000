import type { Day } from "#/domains/preferences/preferences.zod";
import { DAY_AVAILABILITY_PREDICATES } from "#/domains/meals/meals.zod";
import { addDays, toDateKey, nextCalendarDayKey } from "#/lib/date-utils";
import type {
  MealWithCategory,
  SchedulerInput,
  SchedulingRule,
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
  return ELIGIBLE_SEASONS[date.getUTCMonth() + 1]!;
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
    const date = addDays(config.startDate, offset);

    const dayName = DAY_NAMES[date.getUTCDay()]!;
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

type RuleState = {
  rule: SchedulingRule;
  /** Global count — used by per_schedule rules and at_least rules. */
  count: number;
  /** Per-date count — used by per_day at_most rules. Keyed by "YYYY-MM-DD". */
  countsByDate: Map<string, number>;
};

/** Returns true if the meal matches the Rule's subject. */
function mealMatchesSubject(meal: MealWithCategory, rule: SchedulingRule): boolean {
  if (rule.subjectType === "diet") return meal.diet === rule.subjectValue;
  if (rule.subjectType === "category") return meal.categoryId === rule.categoryId;
  if (rule.subjectType === "tag") return meal.tags.includes(rule.subjectValue ?? "");
  return false;
}

/**
 * Returns true if placing this meal in the given slot would exceed any `at_most` Rule.
 * Per-day rules check the count for the slot's calendar day; per-schedule rules check
 * the global count.
 */
function exceedsAtMost(meal: MealWithCategory, states: RuleState[], slotDateKey: string): boolean {
  return states.some(({ rule, count, countsByDate }) => {
    if (rule.operator !== "at_most") return false;
    if (!mealMatchesSubject(meal, rule)) return false;
    if (rule.scope === "per_day") {
      return (countsByDate.get(slotDateKey) ?? 0) >= rule.value;
    }
    return count >= rule.value;
  });
}

/** Increment the appropriate counter for a Rule after a meal is placed. */
function incrementRuleCount(state: RuleState, slotDateKey: string): void {
  if (state.rule.scope === "per_day") {
    state.countsByDate.set(slotDateKey, (state.countsByDate.get(slotDateKey) ?? 0) + 1);
  } else {
    state.count++;
  }
}

/** Count remaining empty slots from index i onwards. */
function remainingEmpty(result: GeneratedSlot[], fromIndex: number): number {
  return result.slice(fromIndex).filter((s) => s.type === "empty").length;
}

/** Total meals still owed by unsatisfied `at_least` Rules. */
function stillNeeded(states: RuleState[]): number {
  return states
    .filter(({ rule }) => rule.operator === "at_least")
    .reduce((sum, { rule, count }) => sum + Math.max(0, rule.value - count), 0);
}

/**
 * Pick a meal from the candidate pool.
 * If `restrictToRequired` is true, only pick meals that satisfy at least one
 * unfulfilled `at_least` Rule (best-effort reservation).
 */
function pickMeal(
  pool: MealWithCategory[],
  usedIds: Set<number>,
  mealTime: "lunch" | "dinner",
  slotDate: Date,
  slotDateKey: string,
  states: RuleState[],
  restrictToRequired: boolean,
): MealWithCategory | null {
  const candidates = pool.filter(
    (m) =>
      !usedIds.has(m.id) &&
      !exceedsAtMost(m, states, slotDateKey) &&
      (m.suitableFor === "any" || m.suitableFor === mealTime) &&
      DAY_AVAILABILITY_PREDICATES[m.dayAvailability](slotDate),
  );

  if (restrictToRequired) {
    const required = candidates.filter((m) =>
      states.some(
        ({ rule, count }) =>
          rule.operator === "at_least" && count < rule.value && mealMatchesSubject(m, rule),
      ),
    );
    if (required.length > 0) return required[0]!;
  }

  return candidates[0] ?? null;
}

// ── Core algorithm ────────────────────────────────────────────────────────────

export class SchedulerService {
  generate(input: SchedulerInput): GeneratedSlot[] {
    const { meals, previousMealIds, preferences, config, rules } = input;

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

    // 3. Effective constraints
    const maxLeftovers = config.maxLeftoverMealsOverride ?? preferences.maxLeftoverMeals;

    // 4. Filter eligible meals: no BBQ, season matches, not in previous schedule
    const eligibleSeasons = getEligibleSeasons(config.startDate);
    const previousIds = new Set(previousMealIds);

    const eligibleMeals = meals.filter(
      (m) => m.season !== "bbq" && eligibleSeasons.has(m.season) && !previousIds.has(m.id),
    );

    if (eligibleMeals.length === 0) return result;

    // 5. Initialise Rule state counters
    const ruleStates: RuleState[] = rules.map((rule) => ({
      rule,
      count: 0,
      countsByDate: new Map(),
    }));

    // 6. Shuffle for variety, then fill slots
    const pool = shuffle(eligibleMeals);
    const usedIds = new Set<number>();
    let leftoverCount = 0;

    for (let i = 0; i < result.length; i++) {
      const slot = result[i]!;
      if (slot.type !== "empty") continue; // already assigned as leftover

      const slotDateKey = toDateKey(slot.date);

      // Best-effort reservation: if remaining empty slots ≤ total still owed by
      // at_least rules, restrict picks to meals that help satisfy those rules.
      const needed = stillNeeded(ruleStates);
      const restrict = needed > 0 && remainingEmpty(result, i) <= needed;

      let meal = pickMeal(
        pool,
        usedIds,
        slot.mealTime,
        slot.date,
        slotDateKey,
        ruleStates,
        restrict,
      );

      // If all meals are used, reset uniqueness and try again (handles small pools)
      if (!meal && usedIds.size > 0) {
        usedIds.clear();
        meal = pickMeal(pool, usedIds, slot.mealTime, slot.date, slotDateKey, ruleStates, restrict);
      }

      if (!meal) continue; // all at_most rules exhausted — leave empty

      // Assign the meal and update Rule counters
      result[i] = { ...slot, type: "filled", mealId: meal.id };
      usedIds.add(meal.id);
      for (const state of ruleStates) {
        if (mealMatchesSubject(meal, state.rule)) incrementRuleCount(state, slotDateKey);
      }

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
            toDateKey(s.date) === nextDayKey,
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
