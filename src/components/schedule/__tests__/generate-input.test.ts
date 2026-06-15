import { describe, expect, it } from "vite-plus/test";
import { normalizeGenerateInput } from "../generate-input";

describe("normalizeGenerateInput", () => {
  it("coerces the start date string to a Date", () => {
    const result = normalizeGenerateInput({
      startDate: "2024-03-15",
      durationWeeks: "1",
      maxLeftoverMealsOverride: "",
    });

    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.startDate.toISOString().slice(0, 10)).toBe("2024-03-15");
  });

  it("coerces durationWeeks to a number", () => {
    const result = normalizeGenerateInput({
      startDate: "2024-03-15",
      durationWeeks: "4",
      maxLeftoverMealsOverride: "",
    });

    expect(result.durationWeeks).toBe(4);
  });

  it("drops the override when blank", () => {
    const result = normalizeGenerateInput({
      startDate: "2024-03-15",
      durationWeeks: "2",
      maxLeftoverMealsOverride: "",
    });

    expect(result.maxLeftoverMealsOverride).toBeUndefined();
  });

  it("coerces the override to a number when present", () => {
    const result = normalizeGenerateInput({
      startDate: "2024-03-15",
      durationWeeks: "2",
      maxLeftoverMealsOverride: "3",
    });

    expect(result.maxLeftoverMealsOverride).toBe(3);
  });

  it("treats an explicit zero override as a value, not blank", () => {
    const result = normalizeGenerateInput({
      startDate: "2024-03-15",
      durationWeeks: "1",
      maxLeftoverMealsOverride: "0",
    });

    expect(result.maxLeftoverMealsOverride).toBe(0);
  });
});
