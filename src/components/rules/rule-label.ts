import type { RuleView } from "#/domains/rules/rules.zod";
import { DIET_SUBJECT_LABELS, OPERATOR_LABELS } from "#/domains/rules/rules.zod";

/**
 * Human-readable description of a Rule: subject + operator + value + scope.
 * Pure. The "per day" suffix only applies to `at_most` per-day rules, matching
 * the form (per-day scope is meaningless for `at_least`).
 */
export function ruleLabel(rule: RuleView, categories: { id: number; name: string }[]): string {
  const op = OPERATOR_LABELS[rule.operator];
  const count = rule.value === 1 ? "1 meal" : `${rule.value} meals`;
  const suffix = rule.operator === "at_most" && rule.scope === "per_day" ? " per day" : "";

  if (rule.subjectType === "category") {
    const name =
      rule.categoryName ?? categories.find((c) => c.id === rule.categoryId)?.name ?? "Unknown";
    return `${op} ${count} from ${name}${suffix}`;
  }
  if (rule.subjectType === "tag") return `${op} ${count} tagged "${rule.subjectValue}"${suffix}`;
  return `${op} ${count} (${DIET_SUBJECT_LABELS[rule.subjectValue ?? ""] ?? rule.subjectValue})${suffix}`;
}
