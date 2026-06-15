import { describe, expect, it } from "vite-plus/test";
import type { RuleView } from "#/domains/rules/rules.zod";
import { toEditDefaults, toInsertInput, type FormValues } from "../rule-form-values";

function values(overrides: Partial<FormValues>): FormValues {
  return {
    subjectType: "diet",
    categoryId: "",
    subjectValue: "meat",
    operator: "at_most",
    value: 3,
    scope: "per_schedule",
    ...overrides,
  };
}

describe("toInsertInput", () => {
  it("builds a category rule with a numeric categoryId", () => {
    const input = toInsertInput(values({ subjectType: "category", categoryId: "5" }));
    expect(input).toEqual({
      subjectType: "category",
      categoryId: 5,
      operator: "at_most",
      value: 3,
      scope: "per_schedule",
    });
  });

  it("builds a tag/diet rule with subjectValue", () => {
    const input = toInsertInput(values({ subjectType: "tag", subjectValue: "quick" }));
    expect(input).toMatchObject({ subjectType: "tag", subjectValue: "quick" });
  });

  it("keeps the chosen scope for at_most rules", () => {
    const input = toInsertInput(values({ operator: "at_most", scope: "per_day" }));
    expect(input.scope).toBe("per_day");
  });

  it("forces scope to per_schedule for at_least rules", () => {
    const input = toInsertInput(values({ operator: "at_least", scope: "per_day" }));
    expect(input.scope).toBe("per_schedule");
  });
});

describe("toEditDefaults", () => {
  const baseRule: RuleView = {
    id: 1,
    userId: "user-1",
    subjectType: "category",
    categoryId: 7,
    categoryName: "Pasta",
    subjectValue: null,
    operator: "at_most",
    value: 2,
    scope: "per_day",
    isContradicted: false,
  };

  it("stringifies categoryId and maps fields for editing", () => {
    expect(toEditDefaults(baseRule)).toEqual({
      subjectType: "category",
      categoryId: "7",
      subjectValue: "",
      operator: "at_most",
      value: 2,
      scope: "per_day",
    });
  });

  it("uses empty strings for null categoryId / subjectValue", () => {
    const defaults = toEditDefaults({
      ...baseRule,
      subjectType: "diet",
      categoryId: null,
      subjectValue: null,
    });
    expect(defaults.categoryId).toBe("");
    expect(defaults.subjectValue).toBe("");
  });
});
