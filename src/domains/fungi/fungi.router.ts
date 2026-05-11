import { ORPCError } from "@orpc/server";
import { pub } from "#/orpc";
import type { DomainError } from "#/lib/result";

function fail(error: DomainError): never {
  throw new ORPCError(error.code);
}

// ── Handlers ────────────────────────────────────────────────────────────────

export const listFungi = pub.fungi.list.handler(async ({ context }) => {
  return context.fungiService.list();
});

export const findFungus = pub.fungi.find.handler(async ({ input, context }) => {
  const fungus = await context.fungiService.findById(input.id);
  if (!fungus) throw new ORPCError("NOT_FOUND");
  return fungus;
});

export const createFungus = pub.fungi.create.handler(async ({ input, context }) => {
  const result = await context.fungiService.create(input);
  if (!result.ok) fail(result.error);
  return result.value;
});

export const updateFungus = pub.fungi.update.handler(async ({ input, context }) => {
  const { id, ...data } = input;
  const result = await context.fungiService.update(id, data);
  if (!result.ok) fail(result.error);
  return result.value;
});

export const deleteFungus = pub.fungi.delete.handler(async ({ input, context }) => {
  const result = await context.fungiService.delete(input.id);
  if (!result.ok) fail(result.error);
  return { deleted: result.value };
});
