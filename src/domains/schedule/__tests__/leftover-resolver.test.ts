import { describe, expect, it } from "vite-plus/test";
import { resolveLeftoverReferences } from "../leftover-resolver";
import type { GeneratedSlot } from "../scheduler.types";

const DATE = new Date("2024-01-01");

function slot(
  type: GeneratedSlot["type"],
  mealId: number | null = null,
  sourceSlotIndex: number | null = null,
): GeneratedSlot {
  return { date: DATE, mealTime: "dinner", type, mealId, sourceSlotIndex };
}

describe("resolveLeftoverReferences", () => {
  it("returns an empty array when there are no leftover slots", () => {
    const generated = [slot("filled", 1), slot("empty")];
    const ids = [10, 11];

    expect(resolveLeftoverReferences(generated, ids)).toEqual([]);
  });

  it("maps a leftover's sourceSlotIndex to the correct database ID", () => {
    const generated = [
      slot("filled", 1), // index 0, db id 10
      slot("leftover", 1, 0), // index 1, db id 11, source is index 0
    ];
    const ids = [10, 11];

    const result = resolveLeftoverReferences(generated, ids);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ leftoverDbId: 11, sourceSlotId: 10 });
  });

  it("handles multiple leftover slots each referencing different sources", () => {
    const generated = [
      slot("filled", 1), // index 0, db id 100
      slot("filled", 2), // index 1, db id 101
      slot("leftover", 1, 0), // index 2, db id 102, source → 100
      slot("leftover", 2, 1), // index 3, db id 103, source → 101
    ];
    const ids = [100, 101, 102, 103];

    const result = resolveLeftoverReferences(generated, ids);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ leftoverDbId: 102, sourceSlotId: 100 });
    expect(result).toContainEqual({ leftoverDbId: 103, sourceSlotId: 101 });
  });

  it("skips leftover slots with a null sourceSlotIndex", () => {
    const generated = [
      slot("filled", 1),
      slot("leftover", 1, null), // malformed — no source index
    ];
    const ids = [10, 11];

    expect(resolveLeftoverReferences(generated, ids)).toEqual([]);
  });

  it("does not include non-leftover slots in the result", () => {
    const generated = [slot("filled", 1), slot("empty"), slot("leftover", 1, 0)];
    const ids = [10, 11, 12];

    const result = resolveLeftoverReferences(generated, ids);

    expect(result).toHaveLength(1);
    expect(result[0]!.leftoverDbId).toBe(12);
  });

  it("returns an empty array for an empty slot list", () => {
    expect(resolveLeftoverReferences([], [])).toEqual([]);
  });
});
