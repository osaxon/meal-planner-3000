# ADR 0001: Retain Only the Immediately Previous Schedule

## Status

Accepted

## Context

The Scheduler needs some memory of recently served Meals to avoid repeating them in the next generated Schedule. Without this, the same Meal could appear in back-to-back schedules — undermining the variety the Scheduler is designed to provide.

The options considered were:

1. No history — discard the previous Schedule entirely on generation
2. Retain one previous Schedule — keep it solely as Scheduler input
3. Retain N previous Schedules — fuller history, richer variety rules
4. Full history — never discard past Schedules

## Decision

Retain exactly one previous Schedule per Household. When a new Schedule is generated, the current active Schedule becomes the previous, and any earlier previous Schedule is discarded.

## Consequences

- The Scheduler can enforce "no Meal that appeared in the last schedule" as a constraint, which covers the most common repetition problem (consecutive weeks).
- The data model stays simple: a Household always has at most two Schedules — active and previous.
- Going back further than one Schedule (e.g. "no Meal from the last 3 schedules") is not supported and would require a schema change.
- There is no audit trail or browsing of past plans. This is intentional — the app's purpose is planning ahead, not reviewing the past.
