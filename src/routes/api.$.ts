import "#/polyfill";

import { createFileRoute } from "@tanstack/react-router";
import { createOpenApiHandlers } from "#/orpc/handler-factory";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: createOpenApiHandlers({
      title: "Meal Planner API",
      version: "1.0.0",
      commonSchemas: {
        UndefinedError: { error: "UndefinedError" },
      },
    }),
  },
});
