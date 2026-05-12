import type { GeneratedSlot } from "./scheduler.types";

/**
 * Resolve leftover slot references from array positions to real database IDs.
 *
 * The Scheduler produces GeneratedSlots with `sourceSlotIndex` (an index into
 * the same array). After the slots are inserted into the database we know their
 * real IDs. This function maps each leftover's `sourceSlotIndex` to the
 * corresponding database ID, returning the pairs that need to be persisted.
 *
 * Pure — no database access. Both input arrays must be parallel (index N in
 * `generatedSlots` corresponds to index N in `insertedIds`).
 */
export function resolveLeftoverReferences(
  generatedSlots: GeneratedSlot[],
  insertedIds: number[],
): Array<{ leftoverDbId: number; sourceSlotId: number }> {
  const results: Array<{ leftoverDbId: number; sourceSlotId: number }> = [];

  for (let i = 0; i < generatedSlots.length; i++) {
    const slot = generatedSlots[i]!;
    if (slot.type !== "leftover" || slot.sourceSlotIndex === null) continue;

    const leftoverDbId = insertedIds[i];
    const sourceSlotId = insertedIds[slot.sourceSlotIndex];

    if (leftoverDbId !== undefined && sourceSlotId !== undefined) {
      results.push({ leftoverDbId, sourceSlotId });
    }
  }

  return results;
}
