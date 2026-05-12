import { oc } from "@orpc/contract";
import {
  scheduleWithSlotsSchema,
  generateScheduleInputSchema,
  updateSlotInputSchema,
  slotSelectSchema,
  shoppingListItemSchema,
} from "./schedule.zod";
import { z } from "zod";

export const generateScheduleContract = oc
  .route({
    method: "POST",
    path: "/schedule/generate",
    successStatus: 201,
    summary: "Generate a new schedule",
    tags: ["Schedule"],
  })
  .input(generateScheduleInputSchema)
  .output(scheduleWithSlotsSchema);

export const getActiveScheduleContract = oc
  .route({
    method: "GET",
    path: "/schedule",
    summary: "Get the active schedule with slots",
    tags: ["Schedule"],
  })
  .output(scheduleWithSlotsSchema.nullable());

export const updateSlotContract = oc
  .route({
    method: "PATCH",
    path: "/schedule/slots/{slotId}",
    summary: "Swap or empty a slot in the active schedule",
    tags: ["Schedule"],
  })
  .input(updateSlotInputSchema)
  .output(slotSelectSchema)
  .errors({
    NOT_FOUND: { status: 404, message: "Slot not found in active schedule" },
  });

export const getShoppingListContract = oc
  .route({
    method: "GET",
    path: "/schedule/shopping-list",
    summary: "Get aggregated shopping list for the active schedule",
    tags: ["Schedule"],
  })
  .output(z.array(shoppingListItemSchema));

export const toggleShoppingItemContract = oc
  .route({
    method: "PATCH",
    path: "/schedule/shopping-list/toggle",
    summary: "Toggle check-off state for a shopping list item",
    tags: ["Schedule"],
  })
  .input(z.object({ ingredientKey: z.string() }))
  .output(shoppingListItemSchema)
  .errors({
    NOT_FOUND: { status: 404, message: "No active schedule" },
  });
