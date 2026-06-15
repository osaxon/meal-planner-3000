import { oc } from "@orpc/contract";
import { z } from "zod";
import { shoppingListItemSchema, toggleShoppingItemInputSchema } from "./shopping-list.zod";

export const listShoppingListContract = oc
  .route({
    method: "GET",
    path: "/shopping-list",
    summary: "Get aggregated shopping list for the active schedule",
    tags: ["Shopping List"],
  })
  .output(z.array(shoppingListItemSchema));

export const toggleShoppingItemContract = oc
  .route({
    method: "PATCH",
    path: "/shopping-list/toggle",
    summary: "Toggle check-off state for a shopping list item",
    tags: ["Shopping List"],
  })
  .input(toggleShoppingItemInputSchema)
  .output(shoppingListItemSchema)
  .errors({
    NOT_FOUND: { status: 404, message: "No active schedule" },
  });
