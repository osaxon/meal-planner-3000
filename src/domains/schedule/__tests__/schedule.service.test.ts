import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createTestDb, type TestDb } from "#/db/test-utils";
import { user, categories, meals, schedules, slots } from "#/db/schema";
import { eq, and } from "drizzle-orm";
import { ScheduleService } from "../schedule.service";
import { PreferencesService } from "#/domains/preferences/preferences.service";
import { resolveLeftoverReferences } from "../leftover-resolver";

// Spy seam for failure injection: resolveLeftoverReferences runs inside the
// generation transaction, after the destructive promote/discard + slot insert.
// Forcing it to throw simulates a mid-sequence "network blip to remote DB".
vi.mock("../leftover-resolver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../leftover-resolver")>();
  return { ...actual, resolveLeftoverReferences: vi.fn(actual.resolveLeftoverReferences) };
});

const TEST_USER = { id: "user-1", name: "Alice", email: "alice@example.com" };

let db: TestDb;
let service: ScheduleService;
let categoryId: number;

// Monday 1 Jan 2024 — autumn_winter season
const START_DATE = new Date("2024-01-01");

const BASE_INPUT = { startDate: START_DATE, durationWeeks: 1 as const };

beforeEach(async () => {
  db = await createTestDb();
  service = new ScheduleService(db, new PreferencesService(db));
  await db.insert(user).values(TEST_USER);
  const [cat] = await db
    .insert(categories)
    .values({ userId: TEST_USER.id, name: "Pasta" })
    .returning();
  categoryId = cat!.id;
});

async function seedMeals(count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({
    userId: TEST_USER.id,
    name: `Meal ${i + 1}`,
    categoryId,
    diet: "meat" as const,
    season: "year_round" as const,
    producesLeftovers: false,
  }));
  await db.insert(meals).values(rows);
}

// ── generate ──────────────────────────────────────────────────────────────────

describe("generate", () => {
  it("creates an active schedule with slots", async () => {
    await seedMeals(7);
    const result = await service.generate(TEST_USER.id, BASE_INPUT);

    expect(result.status).toBe("active");
    expect(result.userId).toBe(TEST_USER.id);
    expect(result.durationWeeks).toBe(1);
    expect(result.slots.length).toBeGreaterThan(0);
  });

  it("persists the schedule to the database", async () => {
    await seedMeals(7);
    await service.generate(TEST_USER.id, BASE_INPUT);

    const [saved] = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.userId, TEST_USER.id), eq(schedules.status, "active")));
    expect(saved).toBeDefined();
  });

  it("persists slots with correct types and meal references", async () => {
    await seedMeals(7);
    const result = await service.generate(TEST_USER.id, BASE_INPUT);

    const dbSlots = await db.select().from(slots).where(eq(slots.scheduleId, result.id));

    expect(dbSlots).toHaveLength(result.slots.length);
    for (const slot of dbSlots.filter((s) => s.type === "filled")) {
      expect(slot.mealId).not.toBeNull();
    }
  });

  it("promotes active → previous on second generate", async () => {
    await seedMeals(14);
    const first = await service.generate(TEST_USER.id, BASE_INPUT);
    await service.generate(TEST_USER.id, BASE_INPUT);

    const [prev] = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.userId, TEST_USER.id), eq(schedules.status, "previous")));

    expect(prev!.id).toBe(first.id);
  });

  it("discards the old previous on third generate", async () => {
    await seedMeals(21);
    const first = await service.generate(TEST_USER.id, BASE_INPUT);
    await service.generate(TEST_USER.id, BASE_INPUT);
    await service.generate(TEST_USER.id, BASE_INPUT);

    const allSchedules = await db
      .select()
      .from(schedules)
      .where(eq(schedules.userId, TEST_USER.id));

    expect(allSchedules).toHaveLength(2); // only active + previous remain
    expect(allSchedules.every((s) => s.id !== first.id)).toBe(true);
  });

  it("persists leftover slots with correct sourceSlotId", async () => {
    await db.insert(meals).values([
      {
        userId: TEST_USER.id,
        name: "Big Bolognese",
        categoryId,
        diet: "meat",
        season: "year_round",
        producesLeftovers: true,
      },
      ...Array.from({ length: 6 }, (_, i) => ({
        userId: TEST_USER.id,
        name: `Meal ${i + 2}`,
        categoryId,
        diet: "meat" as const,
        season: "year_round" as const,
        producesLeftovers: false,
      })),
    ]);

    const result = await service.generate(TEST_USER.id, {
      ...BASE_INPUT,
      maxLeftoverMealsOverride: 99,
    });

    const leftoverSlots = result.slots.filter((s) => s.type === "leftover");
    for (const leftover of leftoverSlots) {
      expect(leftover.sourceSlotId).not.toBeNull();
      const source = result.slots.find((s) => s.id === leftover.sourceSlotId);
      expect(source).toBeDefined();
      expect(source!.type).toBe("filled");
      expect(source!.mealId).toBe(leftover.mealId);
    }
  });

  it("stores maxLeftoverMealsOverride on the schedule record", async () => {
    await seedMeals(7);
    const result = await service.generate(TEST_USER.id, {
      ...BASE_INPUT,
      maxLeftoverMealsOverride: 5,
    });

    expect(result.maxLeftoverMealsOverride).toBe(5);
  });

  it("leaves previous and active schedules untouched when persistence fails mid-transaction", async () => {
    await seedMeals(21);
    const first = await service.generate(TEST_USER.id, BASE_INPUT); // active = first
    const second = await service.generate(TEST_USER.id, BASE_INPUT); // previous = first, active = second

    const before = await db.select().from(schedules).where(eq(schedules.userId, TEST_USER.id));
    const beforeSlotIds = (await db.select().from(slots)).map((s) => s.id).sort((a, b) => a - b);

    // Fail the next generate after the destructive promote/discard + slot insert.
    vi.mocked(resolveLeftoverReferences).mockImplementationOnce(() => {
      throw new Error("network blip to remote database");
    });

    await expect(service.generate(TEST_USER.id, BASE_INPUT)).rejects.toThrow("network blip");

    // The whole persistence phase rolled back: schedules and slots are byte-for-byte unchanged.
    const after = await db.select().from(schedules).where(eq(schedules.userId, TEST_USER.id));
    expect(after).toHaveLength(2);
    expect(after.find((s) => s.status === "active")!.id).toBe(second.id);
    expect(after.find((s) => s.status === "previous")!.id).toBe(first.id);
    expect(after.map((s) => ({ id: s.id, status: s.status }))).toEqual(
      before.map((s) => ({ id: s.id, status: s.status })),
    );

    const afterSlotIds = (await db.select().from(slots)).map((s) => s.id).sort((a, b) => a - b);
    expect(afterSlotIds).toEqual(beforeSlotIds);
  });
});

// ── getActive ─────────────────────────────────────────────────────────────────

describe("getActive", () => {
  it("returns null when no schedule exists", async () => {
    const result = await service.getActive(TEST_USER.id);
    expect(result).toBeNull();
  });

  it("returns the active schedule with its slots", async () => {
    await seedMeals(7);
    const generated = await service.generate(TEST_USER.id, BASE_INPUT);

    const active = await service.getActive(TEST_USER.id);

    expect(active).not.toBeNull();
    expect(active!.id).toBe(generated.id);
    expect(active!.slots).toHaveLength(generated.slots.length);
  });

  it("returns null for a different user's schedule", async () => {
    const [otherUser] = await db
      .insert(user)
      .values({ id: "user-2", name: "Bob", email: "bob@example.com" })
      .returning();
    await seedMeals(7);
    await service.generate(TEST_USER.id, BASE_INPUT);

    const result = await service.getActive(otherUser!.id);
    expect(result).toBeNull();
  });
});
