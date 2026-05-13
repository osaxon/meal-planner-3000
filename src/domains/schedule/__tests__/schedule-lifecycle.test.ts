import { beforeEach, describe, expect, it } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "#/db/test-utils";
import { user, schedules } from "#/db/schema";
import { promoteAndInsertSchedule } from "../schedule-lifecycle";

const TEST_USER = { id: "user-1", name: "Alice", email: "alice@example.com" };
const START = new Date("2024-01-01");

const BASE_VALUES = {
  userId: TEST_USER.id,
  startDate: START,
  durationWeeks: 1 as const,
};

let db: TestDb;

beforeEach(async () => {
  db = createTestDb();
  await db.insert(user).values(TEST_USER);
});

async function countSchedules() {
  return (await db.select().from(schedules).where(eq(schedules.userId, TEST_USER.id))).length;
}

async function findByStatus(status: "active" | "previous") {
  const rows = await db.select().from(schedules).where(eq(schedules.userId, TEST_USER.id));
  return rows.find((r) => r.status === status) ?? null;
}

describe("promoteAndInsertSchedule", () => {
  it("inserts a new active schedule when none exist", async () => {
    const result = await promoteAndInsertSchedule({
      db,
      userId: TEST_USER.id,
      prevScheduleId: null,
      existingActiveId: null,
      newScheduleValues: BASE_VALUES,
    });

    expect(result.status).toBe("active");
    expect(result.userId).toBe(TEST_USER.id);
    expect(await countSchedules()).toBe(1);
  });

  it("promotes the active schedule to previous when generating a second schedule", async () => {
    const first = await promoteAndInsertSchedule({
      db,
      userId: TEST_USER.id,
      prevScheduleId: null,
      existingActiveId: null,
      newScheduleValues: BASE_VALUES,
    });

    await promoteAndInsertSchedule({
      db,
      userId: TEST_USER.id,
      prevScheduleId: null,
      existingActiveId: first.id,
      newScheduleValues: BASE_VALUES,
    });

    const active = await findByStatus("active");
    const previous = await findByStatus("previous");

    expect(active).not.toBeNull();
    expect(previous!.id).toBe(first.id);
    expect(await countSchedules()).toBe(2);
  });

  it("discards the old previous and promotes the active on a third generate", async () => {
    const first = await promoteAndInsertSchedule({
      db,
      userId: TEST_USER.id,
      prevScheduleId: null,
      existingActiveId: null,
      newScheduleValues: BASE_VALUES,
    });

    const second = await promoteAndInsertSchedule({
      db,
      userId: TEST_USER.id,
      prevScheduleId: null,
      existingActiveId: first.id,
      newScheduleValues: BASE_VALUES,
    });

    await promoteAndInsertSchedule({
      db,
      userId: TEST_USER.id,
      prevScheduleId: first.id,
      existingActiveId: second.id,
      newScheduleValues: BASE_VALUES,
    });

    const all = await db.select().from(schedules).where(eq(schedules.userId, TEST_USER.id));

    expect(all).toHaveLength(2);
    expect(all.map((s) => s.id)).not.toContain(first.id);
    const statuses = all.map((s) => s.status).sort();
    expect(statuses).toEqual(["active", "previous"]);
  });

  it("stores per-schedule override values on the inserted record", async () => {
    const result = await promoteAndInsertSchedule({
      db,
      userId: TEST_USER.id,
      prevScheduleId: null,
      existingActiveId: null,
      newScheduleValues: {
        ...BASE_VALUES,
        maxLeftoverMealsOverride: 3,
      },
    });

    expect(result.maxLeftoverMealsOverride).toBe(3);
  });
});
