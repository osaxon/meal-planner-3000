# ADR 0002: Meal Suitability Constrains Fresh Cooking Only, Not Leftovers

## Status

Accepted

## Context

Meals have a `suitableFor` property (`lunch`, `dinner`, or `any`) indicating which meal times they are appropriate to freshly prepare. The Scheduler needed a rule to define whether this constraint also applies to Leftover Slots.

Two alternatives were considered:

1. **Suitability applies to all appearances** — a dinner-only Meal cannot appear in any lunch Slot, including as leftovers.
2. **Suitability applies to fresh cooking only** — a dinner-only Meal cannot be freshly cooked for lunch, but its leftovers can be eaten at any time.

## Decision

Suitability constrains **fresh cooking only**. A Leftover Slot is not a fresh cook — it is eating what was already prepared — so the Meal's suitability constraint does not apply to it.

## Consequences

- A Meal marked `suitableFor: "dinner"` (e.g. Shepherd's Pie) will never be placed as a Filled Slot in a lunch position, but its leftovers can be placed in the next day's lunch Slot.
- This enables the natural pattern of cooking a large dinner and eating the leftovers for lunch the following day, without requiring every leftover-producing Meal to be marked `any`.
- The Scheduler's leftover targeting logic (next day lunch → next day dinner → fallback) is independent of the source Meal's `suitableFor` value.
