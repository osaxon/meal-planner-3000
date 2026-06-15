import { SchedulePage } from "#/components/schedule/schedule-page";
import { orpc } from "#/orpc/client";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/schedule")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(orpc.schedule.getActive.queryOptions()),
      context.queryClient.ensureQueryData(orpc.meals.list.queryOptions()),
    ]),
  component: SchedulePage,
});
