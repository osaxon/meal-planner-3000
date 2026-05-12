import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestDb, type TestDb } from "#/db/test-utils";
import { user, categories } from "#/db/schema";
import { MealService } from "../meals.service";

const TEST_USER = { id: "user-1", name: "Alice", email: "alice@example.com" };
const OTHER_USER = { id: "user-2", name: "Bob", email: "bob@example.com" };

let db: TestDb;
let service: MealService;
let categoryId: number;

const MEAL_INPUT = {
  name: "Spaghetti Bolognese",
  diet: "meat" as const,
  season: "year_round" as const,
  producesLeftovers: true,
};

beforeEach(async () => {
  db = createTestDb();
  service = new MealService(db);
  await db.insert(user).values([TEST_USER, OTHER_USER]);
  const [cat] = await db
    .insert(categories)
    .values({ userId: TEST_USER.id, name: "Pasta" })
    .returning();
  categoryId = cat!.id;
});

describe("list", () => {
  it("returns meals for the requesting user with category name", async () => {
    await service.create(TEST_USER.id, { ...MEAL_INPUT, categoryId });

    const result = await service.list(TEST_USER.id);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Spaghetti Bolognese");
    expect(result[0]!.categoryName).toBe("Pasta");
  });

  it("does not return meals belonging to another user", async () => {
    const [otherCat] = await db
      .insert(categories)
      .values({ userId: OTHER_USER.id, name: "Other" })
      .returning();
    await service.create(OTHER_USER.id, { ...MEAL_INPUT, categoryId: otherCat!.id });

    const result = await service.list(TEST_USER.id);

    expect(result).toHaveLength(0);
  });
});

describe("create", () => {
  it("creates a meal and returns it with category name", async () => {
    const result = await service.create(TEST_USER.id, { ...MEAL_INPUT, categoryId });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Spaghetti Bolognese");
    expect(result.value.categoryName).toBe("Pasta");
    expect(result.value.producesLeftovers).toBe(true);
  });

  it("returns CATEGORY_NOT_FOUND when the category does not belong to the user", async () => {
    const [otherCat] = await db
      .insert(categories)
      .values({ userId: OTHER_USER.id, name: "Other" })
      .returning();

    const result = await service.create(TEST_USER.id, {
      ...MEAL_INPUT,
      categoryId: otherCat!.id,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CATEGORY_NOT_FOUND");
  });
});

describe("update", () => {
  it("updates meal fields", async () => {
    const created = await service.create(TEST_USER.id, { ...MEAL_INPUT, categoryId });
    if (!created.ok) throw new Error("setup failed");

    const result = await service.update(created.value.id, TEST_USER.id, {
      name: "Tagliatelle Bolognese",
      season: "autumn_winter",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Tagliatelle Bolognese");
    expect(result.value.season).toBe("autumn_winter");
  });

  it("returns NOT_FOUND for a meal belonging to another user", async () => {
    const created = await service.create(TEST_USER.id, { ...MEAL_INPUT, categoryId });
    if (!created.ok) throw new Error("setup failed");

    const result = await service.update(created.value.id, OTHER_USER.id, { name: "New Name" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("returns CATEGORY_NOT_FOUND when updating to a category from another user", async () => {
    const created = await service.create(TEST_USER.id, { ...MEAL_INPUT, categoryId });
    const [otherCat] = await db
      .insert(categories)
      .values({ userId: OTHER_USER.id, name: "Other" })
      .returning();
    if (!created.ok) throw new Error("setup failed");

    const result = await service.update(created.value.id, TEST_USER.id, {
      categoryId: otherCat!.id,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CATEGORY_NOT_FOUND");
  });
});

describe("delete", () => {
  it("deletes a meal", async () => {
    const created = await service.create(TEST_USER.id, { ...MEAL_INPUT, categoryId });
    if (!created.ok) throw new Error("setup failed");

    const result = await service.delete(created.value.id, TEST_USER.id);

    expect(result.ok).toBe(true);
    expect(await service.list(TEST_USER.id)).toHaveLength(0);
  });

  it("returns NOT_FOUND for a meal belonging to another user", async () => {
    const created = await service.create(TEST_USER.id, { ...MEAL_INPUT, categoryId });
    if (!created.ok) throw new Error("setup failed");

    const result = await service.delete(created.value.id, OTHER_USER.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("cascades to delete ingredients when a meal is deleted", async () => {
    const created = await service.create(TEST_USER.id, { ...MEAL_INPUT, categoryId });
    if (!created.ok) throw new Error("setup failed");
    await service.addIngredient(created.value.id, TEST_USER.id, {
      name: "Pasta",
      quantity: 200,
      unit: "g",
    });

    await service.delete(created.value.id, TEST_USER.id);

    const remaining = await service.list(TEST_USER.id);
    expect(remaining).toHaveLength(0);
  });
});

describe("tags", () => {
  async function createMeal() {
    const result = await service.create(TEST_USER.id, { ...MEAL_INPUT, categoryId });
    if (!result.ok) throw new Error("setup failed");
    return result.value;
  }

  it("new meals have no tags", async () => {
    const meal = await createMeal();
    expect(meal.tags).toEqual([]);
  });

  it("sets tags and returns deduplicated list", async () => {
    const meal = await createMeal();
    const result = await service.setTags(meal.id, TEST_USER.id, ["quick", "weeknight", "quick"]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(["quick", "weeknight"]);
  });

  it("replaces existing tags wholesale", async () => {
    const meal = await createMeal();
    await service.setTags(meal.id, TEST_USER.id, ["quick", "healthy"]);
    const result = await service.setTags(meal.id, TEST_USER.id, ["batch-cook"]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(["batch-cook"]);
  });

  it("clears all tags when called with empty array", async () => {
    const meal = await createMeal();
    await service.setTags(meal.id, TEST_USER.id, ["quick"]);
    const result = await service.setTags(meal.id, TEST_USER.id, []);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  it("includes tags in the list response", async () => {
    const meal = await createMeal();
    await service.setTags(meal.id, TEST_USER.id, ["quick", "healthy"]);

    const meals = await service.list(TEST_USER.id);
    expect(meals[0]!.tags).toEqual(expect.arrayContaining(["quick", "healthy"]));
  });

  it("returns NOT_FOUND for another user's meal", async () => {
    const meal = await createMeal();
    const result = await service.setTags(meal.id, OTHER_USER.id, ["quick"]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });
});

describe("ingredients", () => {
  async function createMeal() {
    const result = await service.create(TEST_USER.id, { ...MEAL_INPUT, categoryId });
    if (!result.ok) throw new Error("setup failed");
    return result.value;
  }

  it("adds an ingredient with optional quantity and unit", async () => {
    const meal = await createMeal();
    const result = await service.addIngredient(meal.id, TEST_USER.id, {
      name: "Chicken breast",
      quantity: 2,
      unit: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Chicken breast");
    expect(result.value.quantity).toBe(2);
    expect(result.value.mealId).toBe(meal.id);
  });

  it("adds an ingredient with no quantity or unit", async () => {
    const meal = await createMeal();
    const result = await service.addIngredient(meal.id, TEST_USER.id, {
      name: "Handful of basil",
      quantity: null,
      unit: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.quantity).toBeNull();
    expect(result.value.unit).toBeNull();
  });

  it("returns NOT_FOUND when adding to a meal that belongs to another user", async () => {
    const meal = await createMeal();
    const result = await service.addIngredient(meal.id, OTHER_USER.id, {
      name: "Onion",
      quantity: null,
      unit: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("lists all ingredients for a meal", async () => {
    const meal = await createMeal();
    await service.addIngredient(meal.id, TEST_USER.id, { name: "Pasta", quantity: 200, unit: "g" });
    await service.addIngredient(meal.id, TEST_USER.id, { name: "Mince", quantity: 500, unit: "g" });

    const result = await service.listIngredients(meal.id, TEST_USER.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
  });

  it("updates an ingredient", async () => {
    const meal = await createMeal();
    const added = await service.addIngredient(meal.id, TEST_USER.id, {
      name: "Pasta",
      quantity: 200,
      unit: "g",
    });
    if (!added.ok) throw new Error("setup failed");

    const result = await service.updateIngredient(meal.id, added.value.id, TEST_USER.id, {
      quantity: 300,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.quantity).toBe(300);
    expect(result.value.name).toBe("Pasta");
  });

  it("deletes an ingredient", async () => {
    const meal = await createMeal();
    const added = await service.addIngredient(meal.id, TEST_USER.id, {
      name: "Garlic",
      quantity: 3,
      unit: "cloves",
    });
    if (!added.ok) throw new Error("setup failed");

    const result = await service.deleteIngredient(meal.id, added.value.id, TEST_USER.id);

    expect(result.ok).toBe(true);
    const list = await service.listIngredients(meal.id, TEST_USER.id);
    if (!list.ok) throw new Error("unexpected");
    expect(list.value).toHaveLength(0);
  });

  it("returns NOT_FOUND when deleting an ingredient from another user's meal", async () => {
    const meal = await createMeal();
    const added = await service.addIngredient(meal.id, TEST_USER.id, {
      name: "Salt",
      quantity: null,
      unit: null,
    });
    if (!added.ok) throw new Error("setup failed");

    const result = await service.deleteIngredient(meal.id, added.value.id, OTHER_USER.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
