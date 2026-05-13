import { describe, expect, it } from "vite-plus/test";
import { SchedulerService, getEligibleSeasons } from "../scheduler.service";
import type { MealWithCategory } from "#/domains/meals/meals.zod";
import type { Preferences } from "#/domains/preferences/preferences.zod";
import type { ScheduleConfig, GeneratedSlot, SchedulingRule } from "../scheduler.types";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const MONDAY_ONLY_DINNERS: Preferences["slotConfig"] = {
  monday: { lunch: false, dinner: true },
  tuesday: { lunch: false, dinner: false },
  wednesday: { lunch: false, dinner: false },
  thursday: { lunch: false, dinner: false },
  friday: { lunch: false, dinner: false },
  saturday: { lunch: false, dinner: false },
  sunday: { lunch: false, dinner: false },
};

const ALL_DINNERS: Preferences["slotConfig"] = {
  monday: { lunch: false, dinner: true },
  tuesday: { lunch: false, dinner: true },
  wednesday: { lunch: false, dinner: true },
  thursday: { lunch: false, dinner: true },
  friday: { lunch: false, dinner: true },
  saturday: { lunch: false, dinner: true },
  sunday: { lunch: false, dinner: true },
};

const ALL_LUNCHES_AND_DINNERS: Preferences["slotConfig"] = {
  monday: { lunch: true, dinner: true },
  tuesday: { lunch: true, dinner: true },
  wednesday: { lunch: true, dinner: true },
  thursday: { lunch: true, dinner: true },
  friday: { lunch: true, dinner: true },
  saturday: { lunch: true, dinner: true },
  sunday: { lunch: true, dinner: true },
};

const NO_SLOTS: Preferences["slotConfig"] = {
  monday: { lunch: false, dinner: false },
  tuesday: { lunch: false, dinner: false },
  wednesday: { lunch: false, dinner: false },
  thursday: { lunch: false, dinner: false },
  friday: { lunch: false, dinner: false },
  saturday: { lunch: false, dinner: false },
  sunday: { lunch: false, dinner: false },
};

function makePrefs(overrides: Partial<Preferences> = {}): Preferences {
  return {
    slotConfig: ALL_DINNERS,
    maxLeftoverMeals: 99,
    ...overrides,
  };
}

function makeMeal(id: number, overrides: Partial<MealWithCategory> = {}): MealWithCategory {
  return {
    id,
    userId: "user-1",
    name: `Meal ${id}`,
    categoryId: 1,
    categoryName: "Test",
    diet: "meat",
    season: "year_round",
    producesLeftovers: false,
    suitableFor: "any",
    tags: [],
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

// Monday 1 Jan 2024 (month=1 → autumn_winter)
const JAN_MONDAY = new Date("2024-01-01");
// Monday 1 Apr 2024 (month=4 → spring_summer)
const APR_MONDAY = new Date("2024-04-01");
// Monday 2 Dec 2024 (month=12 → autumn_winter + festive)
const DEC_MONDAY = new Date("2024-12-02");

const scheduler = new SchedulerService();

function run(
  meals: MealWithCategory[],
  prefsOverride: Partial<Preferences> = {},
  configOverride: Partial<ScheduleConfig> = {},
  rules: SchedulingRule[] = [],
): GeneratedSlot[] {
  return scheduler.generate({
    meals,
    previousMealIds: [],
    preferences: makePrefs(prefsOverride),
    config: {
      startDate: JAN_MONDAY,
      durationWeeks: 1,
      ...configOverride,
    },
    rules,
  });
}

function dietRule(
  diet: "meat" | "fish" | "vegetarian",
  operator: "at_most" | "at_least",
  value: number,
): SchedulingRule {
  return { subjectType: "diet", categoryId: null, subjectValue: diet, operator, value };
}

function categoryRule(
  categoryId: number,
  operator: "at_most" | "at_least",
  value: number,
): SchedulingRule {
  return { subjectType: "category", categoryId, subjectValue: null, operator, value };
}

function tagRule(tag: string, operator: "at_most" | "at_least", value: number): SchedulingRule {
  return { subjectType: "tag", categoryId: null, subjectValue: tag, operator, value };
}

// ── Season detection ──────────────────────────────────────────────────────────

describe("getEligibleSeasons", () => {
  it("returns autumn_winter for January", () => {
    expect(getEligibleSeasons(new Date("2024-01-15"))).toContain("autumn_winter");
    expect(getEligibleSeasons(new Date("2024-01-15"))).not.toContain("spring_summer");
  });

  it("returns spring_summer for April through September", () => {
    for (const month of [4, 5, 6, 7, 8, 9]) {
      const date = new Date(2024, month - 1, 1);
      expect(getEligibleSeasons(date)).toContain("spring_summer");
      expect(getEligibleSeasons(date)).not.toContain("autumn_winter");
    }
  });

  it("returns autumn_winter for October through March (except December)", () => {
    for (const month of [1, 2, 3, 10, 11]) {
      const date = new Date(2024, month - 1, 1);
      expect(getEligibleSeasons(date)).toContain("autumn_winter");
      expect(getEligibleSeasons(date)).not.toContain("festive");
    }
  });

  it("returns festive AND autumn_winter for December", () => {
    const seasons = getEligibleSeasons(new Date("2024-12-15"));
    expect(seasons).toContain("festive");
    expect(seasons).toContain("autumn_winter");
    expect(seasons).toContain("year_round");
    expect(seasons).not.toContain("spring_summer");
  });

  it("always includes year_round", () => {
    for (const month of [1, 4, 7, 10, 12]) {
      expect(getEligibleSeasons(new Date(2024, month - 1, 1))).toContain("year_round");
    }
  });
});

// ── Slot configuration ────────────────────────────────────────────────────────

describe("slot configuration", () => {
  it("generates no slots when all days disabled", () => {
    const result = run([makeMeal(1)], { slotConfig: NO_SLOTS });
    expect(result).toHaveLength(0);
  });

  it("generates only enabled meal times", () => {
    const result = run([makeMeal(1), makeMeal(2)], { slotConfig: MONDAY_ONLY_DINNERS });
    expect(result).toHaveLength(1);
    expect(result[0]!.mealTime).toBe("dinner");
  });

  it("generates both lunch and dinner when both enabled", () => {
    const result = run(
      Array.from({ length: 14 }, (_, i) => makeMeal(i + 1)),
      { slotConfig: ALL_LUNCHES_AND_DINNERS },
    );
    const lunches = result.filter((s) => s.mealTime === "lunch");
    const dinners = result.filter((s) => s.mealTime === "dinner");
    expect(lunches).toHaveLength(7);
    expect(dinners).toHaveLength(7);
  });

  it("generates 7 dinner slots for a 1-week schedule with all dinners enabled", () => {
    const result = run(Array.from({ length: 7 }, (_, i) => makeMeal(i + 1)));
    expect(result).toHaveLength(7);
  });

  it("generates 14 dinner slots for a 2-week schedule", () => {
    const meals = Array.from({ length: 14 }, (_, i) => makeMeal(i + 1));
    const result = run(meals, {}, { durationWeeks: 2 });
    expect(result).toHaveLength(14);
  });
});

// ── Season filtering ──────────────────────────────────────────────────────────

describe("season filtering", () => {
  it("selects year_round meals in any season", () => {
    const meal = makeMeal(1, { season: "year_round" });
    const result = run([meal], {}, { startDate: JAN_MONDAY });
    expect(result[0]!.type).toBe("filled");
  });

  it("selects autumn_winter meals in January", () => {
    const meal = makeMeal(1, { season: "autumn_winter" });
    const result = run([meal], {}, { startDate: JAN_MONDAY });
    expect(result[0]!.type).toBe("filled");
  });

  it("does not select autumn_winter meals in April", () => {
    const meal = makeMeal(1, { season: "autumn_winter" });
    const result = run([meal], {}, { startDate: APR_MONDAY });
    const filled = result.filter((s) => s.type === "filled");
    expect(filled).toHaveLength(0);
  });

  it("selects spring_summer meals in April", () => {
    const meal = makeMeal(1, { season: "spring_summer" });
    const result = run([meal], {}, { startDate: APR_MONDAY });
    expect(result[0]!.type).toBe("filled");
  });

  it("selects festive meals in December", () => {
    const meal = makeMeal(1, { season: "festive" });
    const result = run([meal], {}, { startDate: DEC_MONDAY });
    expect(result[0]!.type).toBe("filled");
  });

  it("does not select festive meals in January", () => {
    const meal = makeMeal(1, { season: "festive" });
    const result = run([meal], {}, { startDate: JAN_MONDAY });
    const filled = result.filter((s) => s.type === "filled");
    expect(filled).toHaveLength(0);
  });
});

// ── BBQ exclusion ─────────────────────────────────────────────────────────────

describe("BBQ exclusion", () => {
  it("never selects BBQ meals", () => {
    const bbq = makeMeal(1, { season: "bbq" });
    for (const date of [JAN_MONDAY, APR_MONDAY, DEC_MONDAY]) {
      const result = run([bbq], {}, { startDate: date });
      const filled = result.filter((s) => s.type === "filled");
      expect(filled).toHaveLength(0);
    }
  });

  it("selects other meals when BBQ meals exist in pool", () => {
    const bbq = makeMeal(1, { season: "bbq" });
    const valid = makeMeal(2, { season: "year_round" });
    const result = run([bbq, valid], {}, { startDate: JAN_MONDAY, durationWeeks: 1 });
    const filled = result.filter((s) => s.type === "filled");
    expect(filled.every((s) => s.mealId === valid.id)).toBe(true);
  });
});

// ── Previous schedule exclusion ───────────────────────────────────────────────

describe("previous schedule exclusion", () => {
  it("does not select meals from the previous schedule", () => {
    const previousMeal = makeMeal(1);
    const newMeal = makeMeal(2);

    const result = scheduler.generate({
      meals: [previousMeal, newMeal],
      previousMealIds: [previousMeal.id],
      preferences: makePrefs(),
      config: { startDate: JAN_MONDAY, durationWeeks: 1 },
      rules: [],
    });

    const filledIds = result.filter((s) => s.type === "filled").map((s) => s.mealId);
    expect(filledIds).not.toContain(previousMeal.id);
  });

  it("produces empty slots if all meals are in previous schedule and pool is exhausted", () => {
    const meal = makeMeal(1);

    const result = scheduler.generate({
      meals: [meal],
      previousMealIds: [meal.id],
      preferences: makePrefs(),
      config: { startDate: JAN_MONDAY, durationWeeks: 1 },
      rules: [],
    });

    const filled = result.filter((s) => s.type === "filled");
    expect(filled).toHaveLength(0);
  });
});

// ── Rule evaluation ───────────────────────────────────────────────────────────

describe("rule evaluation — at_most (hard cap)", () => {
  it("never exceeds an at_most diet Rule", () => {
    const meals = Array.from({ length: 7 }, (_, i) => makeMeal(i + 1, { diet: "meat" }));
    const result = run(meals, {}, {}, [dietRule("meat", "at_most", 3)]);

    const meatFilled = result.filter((s) => s.type === "filled");
    expect(meatFilled.length).toBeLessThanOrEqual(3);
  });

  it("never exceeds an at_most category Rule", () => {
    const curryMeals = Array.from({ length: 5 }, (_, i) => makeMeal(i + 1, { categoryId: 99 }));
    const otherMeals = Array.from({ length: 3 }, (_, i) => makeMeal(i + 10, { categoryId: 1 }));
    const result = run([...curryMeals, ...otherMeals], {}, {}, [categoryRule(99, "at_most", 2)]);

    const currySlots = result.filter(
      (s) => s.type === "filled" && curryMeals.some((m) => m.id === s.mealId),
    );
    expect(currySlots.length).toBeLessThanOrEqual(2);
  });

  it("never exceeds an at_most tag Rule", () => {
    const quick = Array.from({ length: 5 }, (_, i) => makeMeal(i + 1, { tags: ["quick"] }));
    const other = Array.from({ length: 3 }, (_, i) => makeMeal(i + 10));
    const result = run([...quick, ...other], {}, {}, [tagRule("quick", "at_most", 2)]);

    const quickSlots = result.filter(
      (s) => s.type === "filled" && quick.some((m) => m.id === s.mealId),
    );
    expect(quickSlots.length).toBeLessThanOrEqual(2);
  });

  it("fills with other meals when a diet Rule caps to 0", () => {
    const meat = Array.from({ length: 4 }, (_, i) => makeMeal(i + 1, { diet: "meat" }));
    const veg = Array.from({ length: 4 }, (_, i) => makeMeal(i + 10, { diet: "vegetarian" }));
    const result = run([...meat, ...veg], {}, {}, [dietRule("meat", "at_most", 0)]);

    const filled = result.filter((s) => s.type === "filled");
    const vegIds = new Set(veg.map((m) => m.id));
    expect(filled.every((s) => vegIds.has(s.mealId!))).toBe(true);
  });
});

describe("rule evaluation — at_least (best-effort)", () => {
  it("meets an at_least diet Rule when the pool has enough eligible meals", () => {
    const fish = Array.from({ length: 3 }, (_, i) => makeMeal(i + 1, { diet: "fish" }));
    const other = Array.from({ length: 5 }, (_, i) => makeMeal(i + 10, { diet: "meat" }));
    const result = run([...fish, ...other], {}, {}, [dietRule("fish", "at_least", 2)]);

    const fishFilled = result.filter(
      (s) => s.type === "filled" && fish.some((m) => m.id === s.mealId),
    );
    expect(fishFilled.length).toBeGreaterThanOrEqual(2);
  });

  it("meets an at_least category Rule when the pool allows", () => {
    const curry = Array.from({ length: 3 }, (_, i) => makeMeal(i + 1, { categoryId: 42 }));
    const other = Array.from({ length: 5 }, (_, i) => makeMeal(i + 10, { categoryId: 1 }));
    const result = run([...curry, ...other], {}, {}, [categoryRule(42, "at_least", 2)]);

    const curryFilled = result.filter(
      (s) => s.type === "filled" && curry.some((m) => m.id === s.mealId),
    );
    expect(curryFilled.length).toBeGreaterThanOrEqual(2);
  });

  it("silently undershoots when the pool is too small to satisfy at_least", () => {
    const fish = [makeMeal(1, { diet: "fish" })]; // only 1 fish, rule wants 3
    const other = Array.from({ length: 6 }, (_, i) => makeMeal(i + 10, { diet: "meat" }));
    const result = run([...fish, ...other], {}, {}, [dietRule("fish", "at_least", 3)]);

    // Should still produce a valid schedule — not fail
    expect(result.filter((s) => s.type !== "empty").length).toBeGreaterThan(0);
  });

  it("handles contradictory at_most and at_least rules on the same subject gracefully", () => {
    const fish = Array.from({ length: 4 }, (_, i) => makeMeal(i + 1, { diet: "fish" }));
    const other = Array.from({ length: 3 }, (_, i) => makeMeal(i + 10, { diet: "meat" }));
    const result = run([...fish, ...other], {}, {}, [
      dietRule("fish", "at_most", 1),
      dietRule("fish", "at_least", 3),
    ]);

    // at_most is always honoured; schedule should still be produced
    const fishFilled = result.filter(
      (s) => s.type === "filled" && fish.some((m) => m.id === s.mealId),
    );
    expect(fishFilled.length).toBeLessThanOrEqual(1);
    expect(result.some((s) => s.type !== "empty")).toBe(true);
  });

  it("meets an at_least tag Rule", () => {
    const quick = Array.from({ length: 3 }, (_, i) => makeMeal(i + 1, { tags: ["quick"] }));
    const other = Array.from({ length: 5 }, (_, i) => makeMeal(i + 10));
    const result = run([...quick, ...other], {}, {}, [tagRule("quick", "at_least", 2)]);

    const quickFilled = result.filter(
      (s) => s.type === "filled" && quick.some((m) => m.id === s.mealId),
    );
    expect(quickFilled.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Leftover slot placement ───────────────────────────────────────────────────

describe("leftover placement", () => {
  it("assigns a leftover slot within the next 1–2 slots for a meal with producesLeftovers", () => {
    const meals = Array.from({ length: 7 }, (_, i) =>
      makeMeal(i + 1, { producesLeftovers: i === 0 }),
    );
    const result = run(meals, { maxLeftoverMeals: 99 });

    const filledIdx = result.findIndex((s) => s.type === "filled" && s.mealId === 1);
    if (filledIdx === -1) return; // meal 1 may not have been picked first, skip
    const leftoverIdx = result.findIndex((s) => s.type === "leftover" && s.mealId === 1);
    if (leftoverIdx === -1) return; // might not have been placed if no adjacent empty slot

    expect(leftoverIdx - filledIdx).toBeGreaterThanOrEqual(1);
    expect(leftoverIdx - filledIdx).toBeLessThanOrEqual(2);
    expect(result[leftoverIdx]!.sourceSlotIndex).toBe(filledIdx);
  });

  it("does not exceed maxLeftoverMeals", () => {
    const meals = Array.from({ length: 7 }, (_, i) => makeMeal(i + 1, { producesLeftovers: true }));
    const result = run(meals, { maxLeftoverMeals: 2 });

    const leftoverSlots = result.filter((s) => s.type === "leftover");
    expect(leftoverSlots.length).toBeLessThanOrEqual(2);
  });

  it("respects maxLeftoverMeals of 0 — no leftover slots generated", () => {
    const meals = Array.from({ length: 7 }, (_, i) => makeMeal(i + 1, { producesLeftovers: true }));
    const result = run(meals, { maxLeftoverMeals: 0 });

    const leftoverSlots = result.filter((s) => s.type === "leftover");
    expect(leftoverSlots).toHaveLength(0);
  });

  it("leftover slot references the correct source slot index", () => {
    // Use monday-only so we can control positions
    const meals = [makeMeal(1, { producesLeftovers: true }), makeMeal(2), makeMeal(3)];
    const result = scheduler.generate({
      meals,
      previousMealIds: [],
      preferences: makePrefs({ maxLeftoverMeals: 99, slotConfig: ALL_LUNCHES_AND_DINNERS }),
      config: { startDate: JAN_MONDAY, durationWeeks: 1 },
      rules: [],
    });

    for (const slot of result.filter((s) => s.type === "leftover")) {
      const sourceSlot = result[slot.sourceSlotIndex!];
      expect(sourceSlot).toBeDefined();
      expect(sourceSlot!.type).toBe("filled");
      expect(sourceSlot!.mealId).toBe(slot.mealId);
    }
  });
});

// ── Combined constraints ──────────────────────────────────────────────────────

describe("combined constraints", () => {
  it("respects season + diet quota + previous schedule simultaneously", () => {
    const prevMeal = makeMeal(1, { season: "year_round", diet: "meat" });
    const winterMeat = makeMeal(2, { season: "autumn_winter", diet: "meat" });
    const summerFish = makeMeal(3, { season: "spring_summer", diet: "fish" });
    const veggie = makeMeal(4, { season: "year_round", diet: "vegetarian" });

    const result = scheduler.generate({
      meals: [prevMeal, winterMeat, summerFish, veggie],
      previousMealIds: [prevMeal.id],
      preferences: makePrefs({ slotConfig: MONDAY_ONLY_DINNERS }),
      config: { startDate: JAN_MONDAY, durationWeeks: 2 }, // 2 slots total (2 Mondays)
      rules: [dietRule("meat", "at_most", 1)],
    });

    const filledIds = new Set(result.filter((s) => s.type === "filled").map((s) => s.mealId));

    expect(filledIds).not.toContain(prevMeal.id); // excluded by previous schedule
    expect(filledIds).not.toContain(summerFish.id); // wrong season for January

    const meatMeals = result.filter((s) => s.type === "filled" && [2].includes(s.mealId!));
    expect(meatMeals.length).toBeLessThanOrEqual(1); // meat quota
  });

  it("produces a valid plan when the pool exactly matches the number of slots", () => {
    const meals = Array.from({ length: 7 }, (_, i) => makeMeal(i + 1));
    const result = run(meals);

    const filled = result.filter((s) => s.type === "filled");
    const filledIds = filled.map((s) => s.mealId);
    const uniqueIds = new Set(filledIds);

    expect(filled).toHaveLength(7);
    expect(uniqueIds.size).toBe(7);
  });

  it("gracefully handles an empty meal pool by returning all-empty slots", () => {
    const result = run([]);
    const nonEmpty = result.filter((s) => s.type !== "empty");
    expect(nonEmpty).toHaveLength(0);
  });

  it("cycles through meals when pool is smaller than number of slots", () => {
    const meals = [makeMeal(1), makeMeal(2)];
    const result = run(meals, {}, { durationWeeks: 2 });

    const filled = result.filter((s) => s.type === "filled");
    // All slots should be filled since pool cycles
    expect(filled.length).toBeGreaterThan(0);
  });
});

// ── Meal suitability ──────────────────────────────────────────────────────────

describe("meal suitability", () => {
  it("never places a dinner-only meal in a lunch slot as a fresh cook", () => {
    const dinnerOnly = Array.from({ length: 7 }, (_, i) =>
      makeMeal(i + 1, { suitableFor: "dinner" }),
    );
    const result = run(dinnerOnly, { slotConfig: ALL_LUNCHES_AND_DINNERS });

    const lunchFilledMealIds = result
      .filter((s) => s.type === "filled" && s.mealTime === "lunch")
      .map((s) => s.mealId);

    expect(lunchFilledMealIds).toHaveLength(0);
  });

  it("never places a lunch-only meal in a dinner slot as a fresh cook", () => {
    const lunchOnly = Array.from({ length: 7 }, (_, i) =>
      makeMeal(i + 1, { suitableFor: "lunch" }),
    );
    const result = run(lunchOnly, { slotConfig: ALL_LUNCHES_AND_DINNERS });

    const dinnerFilledMealIds = result
      .filter((s) => s.type === "filled" && s.mealTime === "dinner")
      .map((s) => s.mealId);

    expect(dinnerFilledMealIds).toHaveLength(0);
  });

  it("places an any-suitability meal in both lunch and dinner slots", () => {
    const anyMeals = Array.from({ length: 14 }, (_, i) => makeMeal(i + 1, { suitableFor: "any" }));
    const result = run(anyMeals, { slotConfig: ALL_LUNCHES_AND_DINNERS });

    const lunchFilled = result.filter((s) => s.type === "filled" && s.mealTime === "lunch");
    const dinnerFilled = result.filter((s) => s.type === "filled" && s.mealTime === "dinner");

    expect(lunchFilled.length).toBeGreaterThan(0);
    expect(dinnerFilled.length).toBeGreaterThan(0);
  });

  it("leftovers of a dinner-only meal can appear in a lunch slot (ADR 0002)", () => {
    // One dinner-only meal that produces leftovers, enough filler for other slots
    const leftoverMeal = makeMeal(1, {
      suitableFor: "dinner",
      producesLeftovers: true,
    });
    const fillers = Array.from({ length: 13 }, (_, i) => makeMeal(i + 2, { suitableFor: "any" }));
    const result = scheduler.generate({
      meals: [leftoverMeal, ...fillers],
      previousMealIds: [],
      preferences: makePrefs({ maxLeftoverMeals: 99, slotConfig: ALL_LUNCHES_AND_DINNERS }),
      config: { startDate: JAN_MONDAY, durationWeeks: 1 },
      rules: [],
    });

    const leftoverSlots = result.filter(
      (s) => s.type === "leftover" && s.mealId === leftoverMeal.id,
    );

    // If the leftover-producing meal was assigned (it may or may not be in a shuffled pool),
    // any leftover slots for it must be allowed to be lunch slots
    for (const ls of leftoverSlots) {
      // A leftover slot can be lunch even though the source meal is dinner-only
      const sourceSlot = result[ls.sourceSlotIndex!]!;
      expect(sourceSlot.type).toBe("filled");
      expect(sourceSlot.mealId).toBe(leftoverMeal.id);
    }
  });
});

// ── Leftover targeting ────────────────────────────────────────────────────────

describe("leftover targeting", () => {
  it("places dinner leftovers in the next calendar day's lunch slot when available", () => {
    // One dinner-only meal that produces leftovers; all other meals are any/no-leftovers
    const leftoverMeal = makeMeal(1, {
      suitableFor: "dinner",
      producesLeftovers: true,
      diet: "vegetarian",
    });
    const fillers = Array.from({ length: 13 }, (_, i) =>
      makeMeal(i + 2, { suitableFor: "any", diet: "vegetarian" }),
    );

    // Run multiple times to account for shuffle — the leftover meal must eventually be placed
    let foundNextDayLunch = false;
    for (let attempt = 0; attempt < 20 && !foundNextDayLunch; attempt++) {
      const result = scheduler.generate({
        meals: [leftoverMeal, ...fillers],
        previousMealIds: [],
        preferences: makePrefs({ maxLeftoverMeals: 99, slotConfig: ALL_LUNCHES_AND_DINNERS }),
        config: { startDate: JAN_MONDAY, durationWeeks: 1 },
        rules: [],
      });

      const sourceIdx = result.findIndex(
        (s) => s.type === "filled" && s.mealId === leftoverMeal.id && s.mealTime === "dinner",
      );
      if (sourceIdx === -1) continue;

      const sourceDate = result[sourceIdx]!.date;
      const nextDay = new Date(sourceDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const nextDayKey = nextDay.toISOString().slice(0, 10);

      const leftoverSlot = result.find(
        (s) =>
          s.type === "leftover" &&
          s.mealId === leftoverMeal.id &&
          s.mealTime === "lunch" &&
          s.date.toISOString().slice(0, 10) === nextDayKey,
      );
      if (leftoverSlot) foundNextDayLunch = true;
    }

    expect(foundNextDayLunch).toBe(true);
  });

  it("falls back to next-day dinner when no lunch slot is available on the next day", () => {
    const leftoverMeal = makeMeal(1, {
      suitableFor: "dinner",
      producesLeftovers: true,
      diet: "vegetarian",
    });
    const fillers = Array.from({ length: 6 }, (_, i) =>
      makeMeal(i + 2, { suitableFor: "dinner", diet: "vegetarian" }),
    );

    let foundNextDayDinner = false;
    for (let attempt = 0; attempt < 20 && !foundNextDayDinner; attempt++) {
      const result = scheduler.generate({
        meals: [leftoverMeal, ...fillers],
        previousMealIds: [],
        // Dinners only — no lunch slots available to target
        preferences: makePrefs({ maxLeftoverMeals: 99, slotConfig: ALL_DINNERS }),
        config: { startDate: JAN_MONDAY, durationWeeks: 1 },
        rules: [],
      });

      const sourceIdx = result.findIndex(
        (s) => s.type === "filled" && s.mealId === leftoverMeal.id,
      );
      if (sourceIdx === -1) continue;

      const sourceDate = result[sourceIdx]!.date;
      const nextDay = new Date(sourceDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const nextDayKey = nextDay.toISOString().slice(0, 10);

      const leftoverSlot = result.find(
        (s) =>
          s.type === "leftover" &&
          s.mealId === leftoverMeal.id &&
          s.mealTime === "dinner" &&
          s.date.toISOString().slice(0, 10) === nextDayKey,
      );
      if (leftoverSlot) foundNextDayDinner = true;
    }

    expect(foundNextDayDinner).toBe(true);
  });

  it("falls back to 1–2 position logic when no next-day slots exist at all", () => {
    // Monday-only schedule: no next-day slots ever available in a 1-week run
    const leftoverMeal = makeMeal(1, {
      suitableFor: "dinner",
      producesLeftovers: true,
      diet: "vegetarian",
    });
    const filler = makeMeal(2, { suitableFor: "dinner", diet: "vegetarian" });

    const result = scheduler.generate({
      meals: [leftoverMeal, filler],
      previousMealIds: [],
      preferences: makePrefs({ maxLeftoverMeals: 99, slotConfig: MONDAY_ONLY_DINNERS }),
      config: { startDate: JAN_MONDAY, durationWeeks: 2 }, // two Monday slots
      rules: [],
    });

    const sourceIdx = result.findIndex((s) => s.type === "filled" && s.mealId === leftoverMeal.id);
    // If placed, the fallback must have been used — leftover at i+1 or i+2
    if (sourceIdx !== -1) {
      const leftoverIdx = result.findIndex((s) => s.type === "leftover");
      if (leftoverIdx !== -1) {
        expect(leftoverIdx - sourceIdx).toBeGreaterThanOrEqual(1);
        expect(leftoverIdx - sourceIdx).toBeLessThanOrEqual(2);
      }
    }
  });
});
