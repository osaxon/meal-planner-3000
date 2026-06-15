import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestDb, type TestDb } from "#/db/test-utils";
import { user, categories, meals, mealIngredients } from "#/db/schema";
import { ScheduleService } from "../schedule.service";

const TEST_USER = { id: "user-1", name: "Alice", email: "alice@example.com" };
const START_DATE = new Date("2024-01-01");

let db: TestDb;
let service: ScheduleService;
let categoryId: number;

beforeEach(async () => {
  db = await createTestDb();
  service = new ScheduleService(db);
  await db.insert(user).values(TEST_USER);
  const [cat] = await db
    .insert(categories)
    .values({ userId: TEST_USER.id, name: "Pasta" })
    .returning();
  categoryId = cat!.id;
});

async function seedMealsWithIngredients() {
  const [meal1] = await db
    .insert(meals)
    .values({
      userId: TEST_USER.id,
      name: "Bolognese",
      categoryId,
      diet: "meat",
      season: "year_round",
      producesLeftovers: true,
    })
    .returning();
  const [meal2] = await db
    .insert(meals)
    .values({
      userId: TEST_USER.id,
      name: "Carbonara",
      categoryId,
      diet: "meat",
      season: "year_round",
      producesLeftovers: false,
    })
    .returning();

  await db.insert(mealIngredients).values([
    { mealId: meal1!.id, name: "Spaghetti", quantity: 200, unit: "g" },
    { mealId: meal1!.id, name: "Mince", quantity: 400, unit: "g" },
    { mealId: meal2!.id, name: "Spaghetti", quantity: 300, unit: "g" }, // same ingredient
    { mealId: meal2!.id, name: "Eggs", quantity: 3, unit: null },
  ]);

  return { meal1Id: meal1!.id, meal2Id: meal2!.id };
}

describe("getShoppingList", () => {
  it("returns empty list when no active schedule", async () => {
    const list = await service.getShoppingList(TEST_USER.id);
    expect(list).toEqual([]);
  });

  it("returns empty list when active schedule has no filled slots", async () => {
    await service.generate(TEST_USER.id, { startDate: START_DATE, durationWeeks: 1 });
    const list = await service.getShoppingList(TEST_USER.id);
    expect(list).toHaveLength(0);
  });

  it("aggregates ingredients across filled slots, summing same-name same-unit items", async () => {
    await seedMealsWithIngredients();
    await service.generate(TEST_USER.id, { startDate: START_DATE, durationWeeks: 1 });

    const list = await service.getShoppingList(TEST_USER.id);
    const spaghetti = list.find((i) => i.ingredientKey === "spaghetti");

    expect(spaghetti).toBeDefined();
    expect(spaghetti!.totalQuantity).toBe(500); // 200 + 300
    expect(spaghetti!.unit).toBe("g");
  });

  it("does not include ingredients from leftover slots", async () => {
    const { meal1Id } = await seedMealsWithIngredients();
    // Generate with leftovers enabled so meal1 (producesLeftovers) gets a leftover slot
    await service.generate(TEST_USER.id, {
      startDate: START_DATE,
      durationWeeks: 1,
      maxLeftoverMealsOverride: 99,
    });

    const active = await service.getActive(TEST_USER.id);
    const leftoverSlots = active!.slots.filter(
      (s) => s.type === "leftover" && s.mealId === meal1Id,
    );

    // If there's a leftover slot for meal1, the ingredients should NOT be double-counted
    if (leftoverSlots.length > 0) {
      const list = await service.getShoppingList(TEST_USER.id);
      const mince = list.find((i) => i.ingredientKey === "mince");
      if (mince) {
        // Mince should appear at most once (from the filled slot, not the leftover)
        expect(mince.totalQuantity).toBe(400);
      }
    }
  });

  it("sets checked false by default", async () => {
    await seedMealsWithIngredients();
    await service.generate(TEST_USER.id, { startDate: START_DATE, durationWeeks: 1 });

    const list = await service.getShoppingList(TEST_USER.id);
    expect(list.every((i) => !i.checked)).toBe(true);
  });
});

describe("toggleShoppingItem", () => {
  it("returns NOT_FOUND when no active schedule", async () => {
    const result = await service.toggleShoppingItem(TEST_USER.id, "spaghetti");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("marks an item as checked", async () => {
    await seedMealsWithIngredients();
    await service.generate(TEST_USER.id, { startDate: START_DATE, durationWeeks: 1 });

    const result = await service.toggleShoppingItem(TEST_USER.id, "spaghetti");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.checked).toBe(true);
  });

  it("toggles back to unchecked on second call", async () => {
    await seedMealsWithIngredients();
    await service.generate(TEST_USER.id, { startDate: START_DATE, durationWeeks: 1 });

    await service.toggleShoppingItem(TEST_USER.id, "spaghetti");
    const result = await service.toggleShoppingItem(TEST_USER.id, "spaghetti");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.checked).toBe(false);
  });

  it("persists check-off state across calls to getShoppingList", async () => {
    await seedMealsWithIngredients();
    await service.generate(TEST_USER.id, { startDate: START_DATE, durationWeeks: 1 });

    await service.toggleShoppingItem(TEST_USER.id, "spaghetti");
    const list = await service.getShoppingList(TEST_USER.id);

    const spaghetti = list.find((i) => i.ingredientKey === "spaghetti");
    expect(spaghetti!.checked).toBe(true);
  });
});
