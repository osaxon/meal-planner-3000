import { beforeEach, describe, expect, it } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "#/db/test-utils";
import { user, categories } from "#/db/schema";
import { RulesService } from "../rules.service";

const USER_A = { id: "user-a", name: "Alice", email: "alice@example.com" };
const USER_B = { id: "user-b", name: "Bob", email: "bob@example.com" };

let db: TestDb;
let service: RulesService;
let categoryId: number;

beforeEach(async () => {
  db = await createTestDb();
  service = new RulesService(db);
  await db.insert(user).values([USER_A, USER_B]);
  const [cat] = await db
    .insert(categories)
    .values({ userId: USER_A.id, name: "Curry" })
    .returning();
  categoryId = cat!.id;
});

describe("list", () => {
  it("returns an empty array when no rules exist", async () => {
    expect(await service.list(USER_A.id)).toEqual([]);
  });

  it("does not return rules belonging to another user", async () => {
    await service.create(USER_A.id, {
      subjectType: "diet",
      subjectValue: "meat",
      operator: "at_most",
      value: 4,
    });
    expect(await service.list(USER_B.id)).toHaveLength(0);
  });

  it("includes categoryName from join for category rules", async () => {
    await service.create(USER_A.id, {
      subjectType: "category",
      categoryId,
      operator: "at_most",
      value: 2,
    });
    const rules = await service.list(USER_A.id);
    expect(rules[0]!.categoryName).toBe("Curry");
  });
});

describe("create", () => {
  it("creates a diet rule", async () => {
    const result = await service.create(USER_A.id, {
      subjectType: "diet",
      subjectValue: "fish",
      operator: "at_least",
      value: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subjectType).toBe("diet");
    expect(result.value.subjectValue).toBe("fish");
    expect(result.value.operator).toBe("at_least");
    expect(result.value.value).toBe(2);
  });

  it("creates a tag rule", async () => {
    const result = await service.create(USER_A.id, {
      subjectType: "tag",
      subjectValue: "quick",
      operator: "at_least",
      value: 1,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subjectValue).toBe("quick");
  });

  it("creates a category rule with category FK", async () => {
    const result = await service.create(USER_A.id, {
      subjectType: "category",
      categoryId,
      operator: "at_most",
      value: 3,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categoryId).toBe(categoryId);
  });

  it("returns CATEGORY_NOT_FOUND for a category from another user", async () => {
    const [otherCat] = await db
      .insert(categories)
      .values({ userId: USER_B.id, name: "Pasta" })
      .returning();
    const result = await service.create(USER_A.id, {
      subjectType: "category",
      categoryId: otherCat!.id,
      operator: "at_most",
      value: 2,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CATEGORY_NOT_FOUND");
  });
});

describe("update", () => {
  it("updates operator and value", async () => {
    const created = await service.create(USER_A.id, {
      subjectType: "diet",
      subjectValue: "meat",
      operator: "at_most",
      value: 4,
    });
    if (!created.ok) throw new Error("setup");
    const result = await service.update(created.value.id, USER_A.id, { value: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.value).toBe(3);
  });

  it("returns NOT_FOUND for another user's rule", async () => {
    const created = await service.create(USER_A.id, {
      subjectType: "diet",
      subjectValue: "meat",
      operator: "at_most",
      value: 4,
    });
    if (!created.ok) throw new Error("setup");
    const result = await service.update(created.value.id, USER_B.id, { value: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });
});

describe("delete", () => {
  it("deletes a rule", async () => {
    const created = await service.create(USER_A.id, {
      subjectType: "diet",
      subjectValue: "meat",
      operator: "at_most",
      value: 4,
    });
    if (!created.ok) throw new Error("setup");
    const result = await service.delete(created.value.id, USER_A.id);
    expect(result.ok).toBe(true);
    expect(await service.list(USER_A.id)).toHaveLength(0);
  });

  it("returns NOT_FOUND for another user's rule", async () => {
    const created = await service.create(USER_A.id, {
      subjectType: "diet",
      subjectValue: "meat",
      operator: "at_most",
      value: 4,
    });
    if (!created.ok) throw new Error("setup");
    const result = await service.delete(created.value.id, USER_B.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("cascade-deletes the rule when the referenced category is deleted", async () => {
    await service.create(USER_A.id, {
      subjectType: "category",
      categoryId,
      operator: "at_most",
      value: 2,
    });
    await db.delete(categories).where(eq(categories.id, categoryId));
    expect(await service.list(USER_A.id)).toHaveLength(0);
  });
});

describe("contradiction detection", () => {
  it("marks isContradicted false when no contradictions exist", async () => {
    await service.create(USER_A.id, {
      subjectType: "diet",
      subjectValue: "meat",
      operator: "at_most",
      value: 4,
    });
    const rules = await service.list(USER_A.id);
    expect(rules[0]!.isContradicted).toBe(false);
  });

  it("marks both rules isContradicted when at_least > at_most for the same subject", async () => {
    await service.create(USER_A.id, {
      subjectType: "diet",
      subjectValue: "fish",
      operator: "at_most",
      value: 1,
    });
    await service.create(USER_A.id, {
      subjectType: "diet",
      subjectValue: "fish",
      operator: "at_least",
      value: 3,
    });
    const rules = await service.list(USER_A.id);
    expect(rules.every((r) => r.isContradicted)).toBe(true);
  });

  it("does not mark rules contradicted when at_least <= at_most", async () => {
    await service.create(USER_A.id, {
      subjectType: "diet",
      subjectValue: "fish",
      operator: "at_most",
      value: 4,
    });
    await service.create(USER_A.id, {
      subjectType: "diet",
      subjectValue: "fish",
      operator: "at_least",
      value: 2,
    });
    const rules = await service.list(USER_A.id);
    expect(rules.every((r) => !r.isContradicted)).toBe(true);
  });

  it("only marks rules on the contradicted subject, not unrelated rules", async () => {
    await service.create(USER_A.id, {
      subjectType: "diet",
      subjectValue: "fish",
      operator: "at_most",
      value: 1,
    });
    await service.create(USER_A.id, {
      subjectType: "diet",
      subjectValue: "fish",
      operator: "at_least",
      value: 3,
    });
    await service.create(USER_A.id, {
      subjectType: "diet",
      subjectValue: "meat",
      operator: "at_most",
      value: 4,
    });
    const rules = await service.list(USER_A.id);
    const meatRule = rules.find((r) => r.subjectValue === "meat")!;
    expect(meatRule.isContradicted).toBe(false);
  });
});
