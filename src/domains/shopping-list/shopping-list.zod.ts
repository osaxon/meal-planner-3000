import { z } from "zod";

export const shoppingListItemSchema = z.object({
  ingredientKey: z.string(),
  name: z.string(),
  totalQuantity: z.number().nullable(),
  unit: z.string().nullable(),
  checked: z.boolean(),
});

export const toggleShoppingItemInputSchema = z.object({
  ingredientKey: z.string(),
});

export type ShoppingListItem = z.infer<typeof shoppingListItemSchema>;
export type ToggleShoppingItemInput = z.infer<typeof toggleShoppingItemInputSchema>;
