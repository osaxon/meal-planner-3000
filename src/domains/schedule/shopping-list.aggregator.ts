import type { ShoppingListItem } from "./schedule.zod";

type IngredientRow = {
  name: string;
  quantity: number | null;
  unit: string | null;
};

/**
 * Aggregate a flat list of Ingredient rows into a Shopping List.
 *
 * Groups by normalised name (lowercased, trimmed). Within each group:
 * - If all items share the same unit (including all-null), quantities are summed.
 * - If any item has a null quantity, or units are inconsistent, totalQuantity is null.
 *
 * `checkedKeys` marks which ingredientKeys have been checked off.
 */
export function aggregateIngredients(
  ingredients: IngredientRow[],
  checkedKeys: Set<string> = new Set(),
): ShoppingListItem[] {
  type Group = { name: string; items: IngredientRow[] };
  const groups = new Map<string, Group>();

  for (const ing of ingredients) {
    const key = ing.name.toLowerCase().trim();
    const g = groups.get(key) ?? { name: ing.name, items: [] };
    g.items.push(ing);
    groups.set(key, g);
  }

  return Array.from(groups.entries()).map(([key, { name, items }]) => {
    const units = new Set(items.map((i) => i.unit ?? null));
    const allSameUnit = units.size === 1;
    const unit = allSameUnit ? ([...units][0] ?? null) : null;
    const totalQuantity =
      allSameUnit && items.every((i) => i.quantity !== null)
        ? items.reduce((sum, i) => sum + (i.quantity ?? 0), 0)
        : null;

    return { ingredientKey: key, name, totalQuantity, unit, checked: checkedKeys.has(key) };
  });
}
