import { and, eq } from "drizzle-orm";
import { schedulingRules, categories } from "#/db/schema";
import { noopCollector } from "#/lib/wide-event";
import { ok, err } from "#/lib/result";
import type { AppDb } from "#/db/factory";
import type { EventCollector } from "#/lib/wide-event";
import type { Result, DomainError } from "#/lib/result";
import type { RuleInsert, RuleUpdate, RuleView } from "./rules.zod";

type NotFound = DomainError<"NOT_FOUND">;
type CategoryNotFound = DomainError<"CATEGORY_NOT_FOUND">;

type Name = "rules";

// ── Contradiction detection ───────────────────────────────────────────────────

/** A string key uniquely identifying a rule's subject across types. */
function subjectKey(rule: {
  subjectType: string;
  categoryId: number | null;
  subjectValue: string | null;
}): string {
  if (rule.subjectType === "category") return `category:${rule.categoryId}`;
  return `${rule.subjectType}:${rule.subjectValue}`;
}

/**
 * Returns the set of rule IDs that form a contradictory pair on the same subject
 * (an `at_least N` and an `at_most M` where N > M).
 */
function contradictedIds(rules: Array<typeof schedulingRules.$inferSelect>): Set<number> {
  const bySubject = new Map<string, typeof rules>();
  for (const r of rules) {
    const k = subjectKey(r);
    const group = bySubject.get(k) ?? [];
    group.push(r);
    bySubject.set(k, group);
  }

  const contradicted = new Set<number>();
  for (const group of bySubject.values()) {
    const atLeast = group.filter((r) => r.operator === "at_least");
    const atMost = group.filter((r) => r.operator === "at_most");
    for (const al of atLeast) {
      for (const am of atMost) {
        if (al.value > am.value) {
          contradicted.add(al.id);
          contradicted.add(am.id);
        }
      }
    }
  }
  return contradicted;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class RulesService {
  private readonly events: EventCollector<Name>;

  constructor(
    private readonly db: AppDb,
    events?: EventCollector<Name>,
  ) {
    this.events = events ?? noopCollector;
  }

  async list(userId: string): Promise<RuleView[]> {
    const rows = await this.db
      .select({
        id: schedulingRules.id,
        userId: schedulingRules.userId,
        subjectType: schedulingRules.subjectType,
        categoryId: schedulingRules.categoryId,
        categoryName: categories.name,
        subjectValue: schedulingRules.subjectValue,
        operator: schedulingRules.operator,
        value: schedulingRules.value,
        scope: schedulingRules.scope,
      })
      .from(schedulingRules)
      .leftJoin(categories, eq(schedulingRules.categoryId, categories.id))
      .where(eq(schedulingRules.userId, userId));

    const rawRows = await this.db
      .select()
      .from(schedulingRules)
      .where(eq(schedulingRules.userId, userId));

    const contradicted = contradictedIds(rawRows);

    return rows.map((r) => ({ ...r, isContradicted: contradicted.has(r.id) }));
  }

  async create(userId: string, input: RuleInsert): Promise<Result<RuleView, CategoryNotFound>> {
    if (input.subjectType === "category") {
      const [cat] = await this.db
        .select()
        .from(categories)
        .where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId)));
      if (!cat) {
        return err({
          code: "CATEGORY_NOT_FOUND",
          message: `Category ${input.categoryId} not found`,
        });
      }

      const [row] = await this.db
        .insert(schedulingRules)
        .values({
          userId,
          subjectType: "category",
          categoryId: input.categoryId,
          operator: input.operator,
          value: input.value,
          scope: input.operator === "at_least" ? "per_schedule" : (input.scope ?? "per_schedule"),
        })
        .returning();
      this.events.addDetail("rules.created", { id: row!.id });
      const [view] = await this.list(userId).then((list) => list.filter((r) => r.id === row!.id));
      return ok(view!);
    }

    const [row] = await this.db
      .insert(schedulingRules)
      .values({
        userId,
        subjectType: input.subjectType,
        subjectValue: input.subjectValue,
        operator: input.operator,
        value: input.value,
        scope: input.operator === "at_least" ? "per_schedule" : (input.scope ?? "per_schedule"),
      })
      .returning();
    this.events.addDetail("rules.created", { id: row!.id });
    const [view] = await this.list(userId).then((list) => list.filter((r) => r.id === row!.id));
    return ok(view!);
  }

  async update(id: number, userId: string, input: RuleUpdate): Promise<Result<RuleView, NotFound>> {
    const [updated] = await this.db
      .update(schedulingRules)
      .set({
        ...(input.operator !== undefined && { operator: input.operator }),
        ...(input.value !== undefined && { value: input.value }),
        ...(input.scope !== undefined && { scope: input.scope }),
      })
      .where(and(eq(schedulingRules.id, id), eq(schedulingRules.userId, userId)))
      .returning();
    if (!updated) return err({ code: "NOT_FOUND", message: `Rule ${id} not found` });

    const [view] = await this.list(userId).then((list) => list.filter((r) => r.id === id));
    return ok(view!);
  }

  async delete(id: number, userId: string): Promise<Result<true, NotFound>> {
    const result = await this.db
      .delete(schedulingRules)
      .where(and(eq(schedulingRules.id, id), eq(schedulingRules.userId, userId)))
      .returning();
    if (result.length === 0) return err({ code: "NOT_FOUND", message: `Rule ${id} not found` });
    this.events.addDetail("rules.deleted", { id });
    return ok(true);
  }
}
