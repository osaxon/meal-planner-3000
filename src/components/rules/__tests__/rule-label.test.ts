import { describe, expect, it } from "vite-plus/test";
import type { RuleView } from "#/domains/rules/rules.zod";
import { ruleLabel } from "../rule-label";

function rule(overrides: Partial<RuleView>): RuleView {
  return {
    id: 1,
    userId: "user-1",
    subjectType: "diet",
    categoryId: null,
    categoryName: null,
    subjectValue: "meat",
    operator: "at_most",
    value: 3,
    scope: "per_schedule",
    isContradicted: false,
    ...overrides,
  };
}

const categories = [
  { id: 1, name: "Pasta" },
  { id: 2, name: "Curry" },
];

describe("ruleLabel", () => {
  describe("category subject", () => {
    it("uses the rule's categoryName when present", () => {
      const label = ruleLabel(
        rule({ subjectType: "category", categoryId: 1, categoryName: "Pasta" }),
        categories,
      );
      expect(label).toBe("At most 3 meals from Pasta");
    });

    it("falls back to the categories list when categoryName is null", () => {
      const label = ruleLabel(
        rule({ subjectType: "category", categoryId: 2, categoryName: null }),
        categories,
      );
      expect(label).toBe("At most 3 meals from Curry");
    });

    it("shows 'Unknown' when the category cannot be resolved", () => {
      const label = ruleLabel(
        rule({ subjectType: "category", categoryId: 99, categoryName: null }),
        categories,
      );
      expect(label).toBe("At most 3 meals from Unknown");
    });
  });

  describe("tag subject", () => {
    it("quotes the tag value", () => {
      const label = ruleLabel(rule({ subjectType: "tag", subjectValue: "quick" }), categories);
      expect(label).toBe('At most 3 meals tagged "quick"');
    });
  });

  describe("diet subject", () => {
    it("uses the human diet label", () => {
      const label = ruleLabel(
        rule({ subjectType: "diet", subjectValue: "vegetarian", operator: "at_least", value: 2 }),
        categories,
      );
      expect(label).toBe("At least 2 meals (Vegetarian)");
    });
  });

  describe("count pluralisation", () => {
    it("uses singular 'meal' for a value of 1", () => {
      expect(
        ruleLabel(rule({ subjectType: "diet", subjectValue: "fish", value: 1 }), categories),
      ).toBe("At most 1 meal (Fish)");
    });

    it("uses plural 'meals' for values above 1", () => {
      expect(
        ruleLabel(rule({ subjectType: "diet", subjectValue: "fish", value: 4 }), categories),
      ).toBe("At most 4 meals (Fish)");
    });
  });

  describe("per-day suffix", () => {
    it("appends ' per day' for at_most per_day rules", () => {
      const label = ruleLabel(
        rule({ subjectType: "category", categoryId: 1, categoryName: "Pasta", scope: "per_day" }),
        categories,
      );
      expect(label).toBe("At most 3 meals from Pasta per day");
    });

    it("omits the suffix for at_least rules even when scope is per_day", () => {
      const label = ruleLabel(
        rule({ subjectType: "diet", subjectValue: "meat", operator: "at_least", scope: "per_day" }),
        categories,
      );
      expect(label).toBe("At least 3 meals (Meat)");
    });

    it("omits the suffix for per_schedule rules", () => {
      const label = ruleLabel(rule({ subjectType: "tag", subjectValue: "spicy" }), categories);
      expect(label).toBe('At most 3 meals tagged "spicy"');
    });
  });
});
