import { describe, expect, it } from "vite-plus/test";
import {
  addDays,
  toDateKey,
  nextCalendarDayKey,
  formatDayHeader,
  indexSlotsByDateAndTime,
} from "../date-utils";

const JAN_1 = new Date("2024-01-01T00:00:00.000Z");

describe("addDays", () => {
  it("adds a positive number of days", () => {
    expect(toDateKey(addDays(JAN_1, 3))).toBe("2024-01-04");
  });

  it("crosses a month boundary", () => {
    expect(toDateKey(addDays(JAN_1, 31))).toBe("2024-02-01");
  });

  it("crosses a year boundary", () => {
    const dec31 = new Date("2023-12-31T00:00:00.000Z");
    expect(toDateKey(addDays(dec31, 1))).toBe("2024-01-01");
  });

  it("subtracts days when n is negative", () => {
    expect(toDateKey(addDays(JAN_1, -1))).toBe("2023-12-31");
  });

  it("does not mutate the input date", () => {
    const original = new Date(JAN_1);
    addDays(JAN_1, 5);
    expect(JAN_1.toISOString()).toBe(original.toISOString());
  });
});

describe("toDateKey", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(toDateKey(JAN_1)).toBe("2024-01-01");
  });

  it("zero-pads single-digit months and days", () => {
    expect(toDateKey(new Date("2024-03-05T00:00:00.000Z"))).toBe("2024-03-05");
  });

  it("uses UTC, not local time", () => {
    // Midnight UTC is always the same date regardless of local timezone
    expect(toDateKey(new Date("2024-06-15T00:00:00.000Z"))).toBe("2024-06-15");
  });
});

describe("nextCalendarDayKey", () => {
  it("returns the next day's date key", () => {
    expect(nextCalendarDayKey(JAN_1)).toBe("2024-01-02");
  });

  it("crosses a month boundary", () => {
    expect(nextCalendarDayKey(new Date("2024-01-31T00:00:00.000Z"))).toBe("2024-02-01");
  });

  it("crosses a year boundary", () => {
    expect(nextCalendarDayKey(new Date("2023-12-31T00:00:00.000Z"))).toBe("2024-01-01");
  });
});

describe("formatDayHeader", () => {
  it("returns the correct weekday and day-month label", () => {
    // 2024-01-01 is a Monday
    const result = formatDayHeader(JAN_1);
    expect(result.weekday).toBe("Mon");
    expect(result.label).toBe("1 Jan");
  });

  it("formats a Sunday correctly", () => {
    // 2024-01-07 is a Sunday
    const sunday = new Date("2024-01-07T00:00:00.000Z");
    expect(formatDayHeader(sunday).weekday).toBe("Sun");
  });

  it("formats a December date correctly", () => {
    const dec25 = new Date("2024-12-25T00:00:00.000Z");
    const result = formatDayHeader(dec25);
    expect(result.weekday).toBe("Wed");
    expect(result.label).toBe("25 Dec");
  });
});

describe("indexSlotsByDateAndTime", () => {
  it("returns an empty Map for an empty array", () => {
    expect(indexSlotsByDateAndTime([])).toEqual(new Map());
  });

  it("keys each slot by YYYY-MM-DD|mealTime", () => {
    const slot = { date: JAN_1, mealTime: "dinner", id: 1 };
    const index = indexSlotsByDateAndTime([slot]);
    expect(index.get("2024-01-01|dinner")).toBe(slot);
  });

  it("indexes both lunch and dinner slots independently", () => {
    const lunch = { date: JAN_1, mealTime: "lunch", id: 1 };
    const dinner = { date: JAN_1, mealTime: "dinner", id: 2 };
    const index = indexSlotsByDateAndTime([lunch, dinner]);
    expect(index.get("2024-01-01|lunch")).toBe(lunch);
    expect(index.get("2024-01-01|dinner")).toBe(dinner);
  });

  it("indexes slots across multiple dates", () => {
    const jan1 = { date: JAN_1, mealTime: "dinner", id: 1 };
    const jan2 = { date: addDays(JAN_1, 1), mealTime: "dinner", id: 2 };
    const index = indexSlotsByDateAndTime([jan1, jan2]);
    expect(index.get("2024-01-01|dinner")?.id).toBe(1);
    expect(index.get("2024-01-02|dinner")?.id).toBe(2);
  });
});
