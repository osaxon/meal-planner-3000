# ADR 0003: Replace Fixed Diet Constraints with User-Defined Scheduling Rules

## Status

Accepted

## Context

The Scheduler originally enforced two fixed diet quotas stored as named columns on the Household Preferences record: `maxMeatMeals` and `maxFishMeals`. These were `at most N` upper bounds, configurable in the Preferences UI and overridable per Schedule at generation time.

When user-defined Scheduling Rules were introduced (subject + operator + value), the same constraints became expressible as Rules: a Rule with subject `diet:meat`, operator `at most`, value `N` is semantically identical to `maxMeatMeals = N`.

Two approaches were considered:

1. **Coexist** — keep `maxMeatMeals` and `maxFishMeals` as fixed columns AND add user-defined Rules. Both constraints would apply; the stricter one would win. Per-schedule override fields would remain on the Schedule record.

2. **Replace** — remove `maxMeatMeals` and `maxFishMeals` entirely. Migrate existing values to pre-populated Rules. Remove the per-schedule override fields. The Rule system becomes the single source of diet selection constraints.

## Decision

Replace. The fixed columns are removed and existing values are migrated to pre-populated Rules on deployment.

The per-schedule override fields (`maxMeatMealsOverride`, `maxFishMealsOverride`) are also removed from the Schedule record schema and the generate form. If a household wants different constraints for a specific week, they edit their global Rules before generating.

`maxLeftoverMeals` is explicitly **not** migrated to a Rule — it controls leftover slot behaviour rather than meal selection, and does not fit the Rule model.

`noPreviousScheduleRepeats` is explicitly **not** migrated to a Rule — it is a permanent scheduling invariant, not a household preference.

## Consequences

- A schema migration converts existing `maxMeatMeals` and `maxFishMeals` values to Rules for every Household. This is a one-way migration.
- The generate form loses the per-schedule diet override fields, which simplifies the UI.
- The Scheduler receives a flat list of Rules rather than two named fields. All selection constraint logic flows through the Rule evaluator.
- Households that relied on per-schedule diet overrides must now edit global Rules before generating. This is a deliberate trade-off: per-schedule flexibility was a workaround for the rigidity of fixed constraints; flexible Rules remove the need for it.
- Future diet-related constraints (e.g. `maxVegetarianMeals`) are added as Rules, not as new columns on Household Preferences.
