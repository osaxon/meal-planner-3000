import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestDb, type TestDb } from "#/db/test-utils";
import { user, meals } from "#/db/schema";
import { CategoryService } from "../categories.service";

const TEST_USER = { id: "user-1", name: "Alice", email: "alice@example.com" };
const OTHER_USER = { id: "user-2", name: "Bob", email: "bob@example.com" };

let db: TestDb;
let service: CategoryService;

beforeEach(async () => {
  db = createTestDb();
  service = new CategoryService(db);
  await db.insert(user).values([TEST_USER, OTHER_USER]);
});

describe("list", () => {
  it("returns only categories belonging to the requesting user", async () => {
    await service.create(TEST_USER.id, { name: "Pasta" });
    await service.create(OTHER_USER.id, { name: "Curry" });

    const result = await service.list(TEST_USER.id);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Pasta");
  });

  it("returns empty array when user has no categories", async () => {
    const result = await service.list(TEST_USER.id);
    expect(result).toEqual([]);
  });
});

describe("create", () => {
  it("creates a category and returns it", async () => {
    const result = await service.create(TEST_USER.id, { name: "Soup" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Soup");
    expect(result.value.userId).toBe(TEST_USER.id);
  });

  it("returns DUPLICATE when name already exists for the same user", async () => {
    await service.create(TEST_USER.id, { name: "Pasta" });
    const result = await service.create(TEST_USER.id, { name: "Pasta" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DUPLICATE");
  });

  it("allows the same name for different users", async () => {
    await service.create(TEST_USER.id, { name: "Pasta" });
    const result = await service.create(OTHER_USER.id, { name: "Pasta" });

    expect(result.ok).toBe(true);
  });
});

describe("rename", () => {
  it("renames a category", async () => {
    const created = await service.create(TEST_USER.id, { name: "Stew" });
    if (!created.ok) throw new Error("setup failed");

    const result = await service.rename(created.value.id, TEST_USER.id, "Casserole");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Casserole");
  });

  it("returns NOT_FOUND for a category belonging to a different user", async () => {
    const created = await service.create(TEST_USER.id, { name: "Stew" });
    if (!created.ok) throw new Error("setup failed");

    const result = await service.rename(created.value.id, OTHER_USER.id, "Casserole");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("returns DUPLICATE when the new name already exists for the user", async () => {
    const created = await service.create(TEST_USER.id, { name: "Stew" });
    await service.create(TEST_USER.id, { name: "Curry" });
    if (!created.ok) throw new Error("setup failed");

    const result = await service.rename(created.value.id, TEST_USER.id, "Curry");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DUPLICATE");
  });

  it("allows renaming to the same name (no-op)", async () => {
    const created = await service.create(TEST_USER.id, { name: "Stew" });
    if (!created.ok) throw new Error("setup failed");

    const result = await service.rename(created.value.id, TEST_USER.id, "Stew");

    expect(result.ok).toBe(true);
  });
});

describe("delete", () => {
  it("deletes a category with no meals", async () => {
    const created = await service.create(TEST_USER.id, { name: "Salad" });
    if (!created.ok) throw new Error("setup failed");

    const result = await service.delete(created.value.id, TEST_USER.id);

    expect(result.ok).toBe(true);
    const remaining = await service.list(TEST_USER.id);
    expect(remaining).toHaveLength(0);
  });

  it("returns NOT_FOUND for a non-existent category", async () => {
    const result = await service.delete(9999, TEST_USER.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("returns NOT_FOUND for a category belonging to a different user", async () => {
    const created = await service.create(TEST_USER.id, { name: "Salad" });
    if (!created.ok) throw new Error("setup failed");

    const result = await service.delete(created.value.id, OTHER_USER.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("returns HAS_MEALS when the category is referenced by a meal", async () => {
    const created = await service.create(TEST_USER.id, { name: "Pasta" });
    if (!created.ok) throw new Error("setup failed");

    await db.insert(meals).values({
      userId: TEST_USER.id,
      name: "Spaghetti Bolognese",
      categoryId: created.value.id,
      diet: "meat",
      season: "year_round",
      producesLeftovers: false,
    });

    const result = await service.delete(created.value.id, TEST_USER.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("HAS_MEALS");
  });
});
