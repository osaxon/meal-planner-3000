import { ORPCError } from "@orpc/server";
import { authed } from "#/orpc";

export const listShoppingList = authed.shoppingList.list.handler(async ({ context }) => {
  return context.shoppingListService.list(context.user.id);
});

export const toggleShoppingItem = authed.shoppingList.toggle.handler(async ({ input, context }) => {
  const result = await context.shoppingListService.toggle(context.user.id, input.ingredientKey);
  if (!result.ok) throw new ORPCError(result.error.code);
  return result.value;
});
