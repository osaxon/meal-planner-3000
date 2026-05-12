import { ORPCError } from "@orpc/server";
import { authed } from "#/orpc";
import type { DomainError } from "#/lib/result";

function fail(error: DomainError): never {
  throw new ORPCError(error.code);
}

export const listCategories = authed.categories.list.handler(async ({ context }) => {
  return context.categoryService.list(context.user.id);
});

export const createCategory = authed.categories.create.handler(async ({ input, context }) => {
  const result = await context.categoryService.create(context.user.id, input);
  if (!result.ok) fail(result.error);
  return result.value;
});

export const renameCategory = authed.categories.rename.handler(async ({ input, context }) => {
  const { id, name } = input;
  const result = await context.categoryService.rename(id, context.user.id, name);
  if (!result.ok) fail(result.error);
  return result.value;
});

export const deleteCategory = authed.categories.delete.handler(async ({ input, context }) => {
  const result = await context.categoryService.delete(input.id, context.user.id);
  if (!result.ok) fail(result.error);
  return { deleted: result.value };
});
