import { ORPCError } from "@orpc/server";
import { authed } from "#/orpc";
import type { DomainError } from "#/lib/result";

function fail(error: DomainError): never {
  throw new ORPCError(error.code);
}

export const listRules = authed.rules.list.handler(async ({ context }) => {
  return context.rulesService.list(context.user.id);
});

export const createRule = authed.rules.create.handler(async ({ input, context }) => {
  const result = await context.rulesService.create(context.user.id, input);
  if (!result.ok) fail(result.error);
  return result.value;
});

export const updateRule = authed.rules.update.handler(async ({ input, context }) => {
  const { id, ...data } = input;
  const result = await context.rulesService.update(id, context.user.id, data);
  if (!result.ok) fail(result.error);
  return result.value;
});

export const deleteRule = authed.rules.delete.handler(async ({ input, context }) => {
  const result = await context.rulesService.delete(input.id, context.user.id);
  if (!result.ok) fail(result.error);
  return { deleted: result.value };
});
