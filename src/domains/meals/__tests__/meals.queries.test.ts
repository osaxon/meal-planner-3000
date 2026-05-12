import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestDb, type TestDb } from "#/db/test-utils";
import { user, categories, meals, mealTags } from "#/db/schema";
import { queryMealsWithTags } from "../meals.queries";

const USER_A = { id: "user-a", name: "Alice", email: "alice@example.com" };
const USER_B = { id: "user-b", name: "Bob", email: "bob@example.com" };

let db: TestDb;
let categoryId: number;

beforeEach(async () => {
  db = createTestDb();
  await db.insert(user).values([USER_A, USER_B]);
  const [cat] = await db
    .insert(categories)
    .values({ userId: USER_A.id, name: "Pasta" })
    .returning();
  categoryId = cat!.id;
});

async function insertMeal(name: string, userId = USER_A.id) {
  const [row] = await db
    .insert(meals)
    .values({
      userId,
      name,
      categoryId,
      diet: "meat",
      season: "year_round",
      producesLeftovers: false,
      suitableFor: "any",
    })
    .returning();
  return row!;
}

describe("queryMealsWithTags — list all", () => {
  it("returns an empty array when the user has no meals", async () => {
    const result = await queryMealsWithTags(db, USER_A.id);
    expect(result).toEqual([]);
  });

  it("returns all meals for the user with categoryName", async () => {
    await insertMeal("Bolognese");
    await insertMeal("Carbonara");

    const result = await queryMealsWithTags(db, USER_A.id);

    expect(result).toHaveLength(2);
    expect(result.every((m) => m.categoryName === "Pasta")).toBe(true);
  });

  it("orders results by name", async () => {
    await insertMeal("Zuppa");
    await insertMeal("Arrabiata");

    const result = await queryMealsWithTags(db, USER_A.id);

    expect(result[0]!.name).toBe("Arrabiata");
    expect(result[1]!.name).toBe("Zuppa");
  });

  it("does not return meals belonging to another user", async () => {
    const [otherCat] = await db
      .insert(categories)
      .values({ userId: USER_B.id, name: "Other" })
      .returning();
    await db.insert(meals).values({
      userId: USER_B.id,
      name: "Bob's Meal",
      categoryId: otherCat!.id,
      diet: "meat",
      season: "year_round",
      producesLeftovers: false,
      suitableFor: "any",
    });

    const result = await queryMealsWithTags(db, USER_A.id);

    expect(result).toHaveLength(0);
  });

  it("aggregates tags correctly", async () => {
    const meal = await insertMeal("Bolognese");
    await db.insert(mealTags).values([
      { mealId: meal.id, tag: "quick" },
      { mealId: meal.id, tag: "weeknight" },
    ]);

    const result = await queryMealsWithTags(db, USER_A.id);

    expect(result[0]!.tags).toEqual(expect.arrayContaining(["quick", "weeknight"]));
    expect(result[0]!.tags).toHaveLength(2);
  });

  it("returns an empty tags array for meals with no tags", async () => {
    await insertMeal("Carbonara");

    const result = await queryMealsWithTags(db, USER_A.id);

    expect(result[0]!.tags).toEqual([]);
  });

  it("does not leak tags from one meal onto another", async () => {
    const meal1 = await insertMeal("Bolognese");
    const meal2 = await insertMeal("Carbonara");
    await db.insert(mealTags).values([{ mealId: meal1.id, tag: "heavy" }]);

    const result = await queryMealsWithTags(db, USER_A.id);
    const carbonara = result.find((m) => m.id === meal2.id)!;

    expect(carbonara.tags).toEqual([]);
  });
});

describe("queryMealsWithTags — single meal by ID", () => {
  it("returns the meal when it exists and belongs to the user", async () => {
    const meal = await insertMeal("Bolognese");

    const result = await queryMealsWithTags(db, USER_A.id, { mealId: meal.id });

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(meal.id);
    expect(result[0]!.categoryName).toBe("Pasta");
  });

  it("returns an empty array when the meal does not exist", async () => {
    const result = await queryMealsWithTags(db, USER_A.id, { mealId: 9999 });

    expect(result).toEqual([]);
  });

  it("returns an empty array when the meal belongs to a different user", async () => {
    const meal = await insertMeal("Bolognese");

    const result = await queryMealsWithTags(db, USER_B.id, { mealId: meal.id });

    expect(result).toEqual([]);
  });

  it("includes tags for the single meal", async () => {
    const meal = await insertMeal("Bolognese");
    await db.insert(mealTags).values([{ mealId: meal.id, tag: "slow" }]);

    const result = await queryMealsWithTags(db, USER_A.id, { mealId: meal.id });

    expect(result[0]!.tags).toEqual(["slow"]);
  });
});
