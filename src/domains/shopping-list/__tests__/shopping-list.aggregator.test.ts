import { describe, expect, it } from "vite-plus/test";
import { aggregateIngredients } from "../shopping-list.aggregator";

const ing = (name: string, quantity: number | null = null, unit: string | null = null) => ({
  name,
  quantity,
  unit,
});

describe("aggregateIngredients", () => {
  it("returns an empty array for an empty ingredient list", () => {
    expect(aggregateIngredients([])).toEqual([]);
  });

  it("returns a single item for a single ingredient", () => {
    const result = aggregateIngredients([ing("Pasta", 300, "g")]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      ingredientKey: "pasta",
      name: "Pasta",
      totalQuantity: 300,
      unit: "g",
      checked: false,
    });
  });

  it("sums quantities when names and units match", () => {
    const result = aggregateIngredients([ing("Spaghetti", 200, "g"), ing("Spaghetti", 300, "g")]);

    expect(result).toHaveLength(1);
    expect(result[0]!.totalQuantity).toBe(500);
    expect(result[0]!.unit).toBe("g");
  });

  it("normalises the key to lowercase-trimmed but preserves display name from first occurrence", () => {
    const result = aggregateIngredients([
      ing("Chicken Breast", 2, null),
      ing("chicken breast", 3, null),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]!.ingredientKey).toBe("chicken breast");
    expect(result[0]!.name).toBe("Chicken Breast");
    expect(result[0]!.totalQuantity).toBe(5);
  });

  it("sets totalQuantity to null when units differ", () => {
    const result = aggregateIngredients([ing("Garlic", 3, "cloves"), ing("Garlic", 50, "g")]);

    expect(result[0]!.totalQuantity).toBeNull();
    expect(result[0]!.unit).toBeNull();
  });

  it("sets totalQuantity to null when any quantity in the group is null", () => {
    const result = aggregateIngredients([ing("Salt", null, null), ing("Salt", 1, "tsp")]);

    // units differ (null vs "tsp") so totalQuantity is null
    expect(result[0]!.totalQuantity).toBeNull();
  });

  it("sets totalQuantity to null when all quantities in the group are null (no-quantity ingredient)", () => {
    const result = aggregateIngredients([
      ing("Handful of basil", null, null),
      ing("Handful of basil", null, null),
    ]);

    expect(result[0]!.totalQuantity).toBeNull();
    expect(result[0]!.unit).toBeNull();
  });

  it("groups distinct ingredients as separate items", () => {
    const result = aggregateIngredients([ing("Onion", 1, null), ing("Garlic", 3, "cloves")]);

    expect(result).toHaveLength(2);
  });

  it("marks items as checked when their key appears in checkedKeys", () => {
    const checked = new Set(["pasta"]);
    const result = aggregateIngredients([ing("Pasta", 300, "g"), ing("Onion", 1, null)], checked);

    const pasta = result.find((i) => i.ingredientKey === "pasta")!;
    const onion = result.find((i) => i.ingredientKey === "onion")!;

    expect(pasta.checked).toBe(true);
    expect(onion.checked).toBe(false);
  });

  it("defaults checked to false when no checkedKeys are provided", () => {
    const result = aggregateIngredients([ing("Pasta", 300, "g")]);
    expect(result[0]!.checked).toBe(false);
  });

  it("handles all-same null units: sums quantities, unit is null", () => {
    const result = aggregateIngredients([ing("Eggs", 2, null), ing("Eggs", 3, null)]);

    expect(result[0]!.totalQuantity).toBe(5);
    expect(result[0]!.unit).toBeNull();
  });
});
