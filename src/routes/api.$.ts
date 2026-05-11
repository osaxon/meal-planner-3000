import "#/polyfill";

import { createFileRoute } from "@tanstack/react-router";
import { createOpenApiHandlers } from "#/orpc/handler-factory";
import { fungiSelectSchema } from "#/domains/fungi/fungi.zod";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: createOpenApiHandlers({
      title: "Fungi API",
      version: "1.0.0",
      commonSchemas: {
        Fungus: { schema: fungiSelectSchema },
        UndefinedError: { error: "UndefinedError" },
      },
    }),
  },
});
