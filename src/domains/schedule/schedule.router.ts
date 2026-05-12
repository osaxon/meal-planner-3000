import { ORPCError } from "@orpc/server";
import { authed } from "#/orpc";

export const generateSchedule = authed.schedule.generate.handler(async ({ input, context }) => {
  return context.scheduleService.generate(context.user.id, input);
});

export const getActiveSchedule = authed.schedule.getActive.handler(async ({ context }) => {
  return context.scheduleService.getActive(context.user.id);
});

export const getShoppingList = authed.schedule.getShoppingList.handler(async ({ context }) => {
  return context.scheduleService.getShoppingList(context.user.id);
});

export const toggleShoppingItem = authed.schedule.toggleShoppingItem.handler(
  async ({ input, context }) => {
    const result = await context.scheduleService.toggleShoppingItem(
      context.user.id,
      input.ingredientKey,
    );
    if (!result.ok) throw new ORPCError(result.error.code);
    return result.value;
  },
);

export const updateSlot = authed.schedule.updateSlot.handler(async ({ input, context }) => {
  const result = await context.scheduleService.updateSlot(
    input.slotId,
    context.user.id,
    input.mealId,
  );
  if (!result.ok) throw new ORPCError(result.error.code);
  return result.value;
});
