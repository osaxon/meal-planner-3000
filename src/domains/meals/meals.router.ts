import { ORPCError } from "@orpc/server";
import { authed } from "#/orpc";
import type { DomainError } from "#/lib/result";

function fail(error: DomainError): never {
  throw new ORPCError(error.code);
}

export const listMeals = authed.meals.list.handler(async ({ context }) => {
  return context.mealService.list(context.user.id);
});

export const createMeal = authed.meals.create.handler(async ({ input, context }) => {
  const result = await context.mealService.create(context.user.id, input);
  if (!result.ok) fail(result.error);
  return result.value;
});

export const updateMeal = authed.meals.update.handler(async ({ input, context }) => {
  const { id, ...data } = input;
  const result = await context.mealService.update(id, context.user.id, data);
  if (!result.ok) fail(result.error);
  return result.value;
});

export const setTags = authed.meals.setTags.handler(async ({ input, context }) => {
  const result = await context.mealService.setTags(input.id, context.user.id, input.tags);
  if (!result.ok) fail(result.error);
  return result.value;
});

export const deleteMeal = authed.meals.delete.handler(async ({ input, context }) => {
  const result = await context.mealService.delete(input.id, context.user.id);
  if (!result.ok) fail(result.error);
  return { deleted: result.value };
});

export const listIngredients = authed.meals.ingredients.list.handler(async ({ input, context }) => {
  const result = await context.mealService.listIngredients(input.mealId, context.user.id);
  if (!result.ok) fail(result.error);
  return result.value;
});

export const addIngredient = authed.meals.ingredients.add.handler(async ({ input, context }) => {
  const { mealId, ...data } = input;
  const result = await context.mealService.addIngredient(mealId, context.user.id, data);
  if (!result.ok) fail(result.error);
  return result.value;
});

export const updateIngredient = authed.meals.ingredients.update.handler(
  async ({ input, context }) => {
    const { mealId, ingredientId, ...data } = input;
    const result = await context.mealService.updateIngredient(
      mealId,
      ingredientId,
      context.user.id,
      data,
    );
    if (!result.ok) fail(result.error);
    return result.value;
  },
);

export const deleteIngredient = authed.meals.ingredients.delete.handler(
  async ({ input, context }) => {
    const result = await context.mealService.deleteIngredient(
      input.mealId,
      input.ingredientId,
      context.user.id,
    );
    if (!result.ok) fail(result.error);
    return { deleted: result.value };
  },
);
