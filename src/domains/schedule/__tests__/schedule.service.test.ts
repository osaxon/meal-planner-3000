import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestDb, type TestDb } from "#/db/test-utils";
import { user, categories, meals, schedules, slots } from "#/db/schema";
import { eq, and } from "drizzle-orm";
import { ScheduleService } from "../schedule.service";

const TEST_USER = { id: "user-1", name: "Alice", email: "alice@example.com" };

let db: TestDb;
let service: ScheduleService;
let categoryId: number;

// Monday 1 Jan 2024 — autumn_winter season
const START_DATE = new Date("2024-01-01");

const BASE_INPUT = { startDate: START_DATE, durationWeeks: 1 as const };

beforeEach(async () => {
  db = createTestDb();
  service = new ScheduleService(db);
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

  it("stores per-schedule override values on the schedule record", async () => {
    await seedMeals(7);
    const result = await service.generate(TEST_USER.id, {
      ...BASE_INPUT,
      maxMeatMealsOverride: 2,
      maxFishMealsOverride: 1,
    });

    expect(result.maxMeatMealsOverride).toBe(2);
    expect(result.maxFishMealsOverride).toBe(1);
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
