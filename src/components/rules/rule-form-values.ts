import type { RuleInsert, RuleView } from "#/domains/rules/rules.zod";

export type FormValues = {
  subjectType: "category" | "tag" | "diet";
  categoryId: string;
  subjectValue: string;
  operator: "at_most" | "at_least";
  value: number;
  scope: "per_schedule" | "per_day";
};

export const CREATE_DEFAULTS: FormValues = {
  subjectType: "diet",
  categoryId: "",
  subjectValue: "",
  operator: "at_most",
  value: 3,
  scope: "per_schedule",
};

/**
 * Normalize form values into the create contract input. Scope is forced to
 * `per_schedule` for `at_least` rules (per-day is only meaningful for `at_most`).
 * Pure.
 */
export function toInsertInput(values: FormValues): RuleInsert {
  const scope = values.operator === "at_most" ? values.scope : "per_schedule";
  if (values.subjectType === "category") {
    return {
      subjectType: "category",
      categoryId: Number(values.categoryId),
      operator: values.operator,
      value: values.value,
      scope,
    };
  }
  return {
    subjectType: values.subjectType,
    subjectValue: values.subjectValue,
    operator: values.operator,
    value: values.value,
    scope,
  } as RuleInsert;
}

/** Map an existing Rule into the form's default values for editing. Pure. */
export function toEditDefaults(rule: RuleView): FormValues {
  return {
    subjectType: rule.subjectType,
    categoryId: rule.categoryId != null ? String(rule.categoryId) : "",
    subjectValue: rule.subjectValue ?? "",
    operator: rule.operator,
    value: rule.value,
    scope: rule.scope,
  };
}
