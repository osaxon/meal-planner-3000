import "#/polyfill";

import { createFileRoute } from "@tanstack/react-router";
import { createRpcHandlers } from "#/orpc/handler-factory";

export const Route = createFileRoute("/api/rpc/$")({
  server: {
    handlers: createRpcHandlers(),
  },
});
