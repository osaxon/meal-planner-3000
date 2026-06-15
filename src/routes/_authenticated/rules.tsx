import { RulesPage } from "#/components/rules/rules-page";
import { orpc } from "#/orpc/client";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/rules")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(orpc.rules.list.queryOptions()),
      context.queryClient.ensureQueryData(orpc.categories.list.queryOptions()),
    ]),
  component: RulesPage,
});
