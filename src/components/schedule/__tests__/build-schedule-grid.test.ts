import { describe, expect, it } from "vite-plus/test";
import { toDateKey } from "#/lib/date-utils";
import type { ScheduleWithSlots, Slot } from "#/domains/schedule/schedule.zod";
import { buildScheduleGrid } from "../build-schedule-grid";

const START = new Date("2024-01-01T00:00:00.000Z");

function slot(overrides: Partial<Slot>): Slot {
  return {
    id: 1,
    scheduleId: 1,
    date: START,
    mealTime: "dinner",
    type: "filled",
    mealId: 10,
    sourceSlotId: null,
    ...overrides,
  };
}

function schedule(slots: Slot[]): ScheduleWithSlots {
  return {
    id: 1,
    userId: "user-1",
    status: "active",
    startDate: START,
    durationWeeks: 4,
    maxLeftoverMealsOverride: null,
    createdAt: START,
    slots,
  };
}

describe("buildScheduleGrid", () => {
  it("returns seven consecutive days starting at the schedule start for week 0", () => {
    const { days } = buildScheduleGrid(schedule([]), 0);

    expect(days).toHaveLength(7);
    expect(toDateKey(days[0]!)).toBe("2024-01-01");
    expect(toDateKey(days[6]!)).toBe("2024-01-07");
  });

  it("offsets the week start by seven days per week index", () => {
    const { days } = buildScheduleGrid(schedule([]), 1);

    expect(toDateKey(days[0]!)).toBe("2024-01-08");
    expect(toDateKey(days[6]!)).toBe("2024-01-14");
  });

  it("produces a lunch row then a dinner row", () => {
    const { rows } = buildScheduleGrid(schedule([]), 0);

    expect(rows.map((r) => r.mealTime)).toEqual(["lunch", "dinner"]);
    expect(rows[0]!.cells).toHaveLength(7);
  });

  it("places each slot in the cell for its date and meal time", () => {
    const lunchDay0 = slot({ id: 1, mealTime: "lunch", date: START });
    const dinnerDay2 = slot({
      id: 2,
      mealTime: "dinner",
      date: new Date("2024-01-03T00:00:00.000Z"),
    });

    const { rows } = buildScheduleGrid(schedule([lunchDay0, dinnerDay2]), 0);
    const lunchRow = rows.find((r) => r.mealTime === "lunch")!;
    const dinnerRow = rows.find((r) => r.mealTime === "dinner")!;

    expect(lunchRow.cells[0]!.slot?.id).toBe(1);
    expect(dinnerRow.cells[2]!.slot?.id).toBe(2);
  });

  it("leaves cells without a matching slot undefined", () => {
    const { rows } = buildScheduleGrid(schedule([slot({ mealTime: "dinner", date: START })]), 0);
    const lunchRow = rows.find((r) => r.mealTime === "lunch")!;

    expect(lunchRow.cells[0]!.slot).toBeUndefined();
  });

  it("excludes slots from other weeks from the current week's cells", () => {
    const week1Slot = slot({ date: new Date("2024-01-08T00:00:00.000Z"), mealTime: "dinner" });
    const { rows } = buildScheduleGrid(schedule([week1Slot]), 0);
    const dinnerRow = rows.find((r) => r.mealTime === "dinner")!;

    expect(dinnerRow.cells.every((c) => c.slot === undefined)).toBe(true);
  });

  it("coerces string slot dates before indexing", () => {
    const stringDated = {
      ...slot({ id: 7, mealTime: "dinner" }),
      date: "2024-01-01" as unknown as Date,
    };
    const { rows } = buildScheduleGrid(schedule([stringDated]), 0);
    const dinnerRow = rows.find((r) => r.mealTime === "dinner")!;

    expect(dinnerRow.cells[0]!.slot?.id).toBe(7);
  });
});
