import { RPCHandler } from "@orpc/server/fetch";
import { RequestHeadersPlugin } from "@orpc/server/plugins";
import { LoggingHandlerPlugin } from "@orpc/experimental-pino";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { SmartCoercionPlugin } from "@orpc/json-schema";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { createLogger } from "#/lib/logger";
import router from "./router/root";

import type { FetchHandler } from "@orpc/server/fetch";

// ── Shared Helpers ──────────────────────────────────────────────────────────

function loggingPlugin(logger: ReturnType<typeof createLogger>) {
  return new LoggingHandlerPlugin({
    logger,
    generateId: () => crypto.randomUUID(),
    logRequestResponse: false,
    logRequestAbort: false,
  });
}

type HandleFn = (args: { request: Request }) => Promise<Response>;

function createHandle(handler: FetchHandler<any>, prefix: `/${string}`): HandleFn {
  return async ({ request }) => {
    const { response } = await handler.handle(request, { prefix, context: {} });
    return response ?? new Response("Not Found", { status: 404 });
  };
}

/** The six HTTP method handlers TanStack Start expects on a catch-all route. */
export function allMethods(handle: HandleFn) {
  return {
    HEAD: handle,
    GET: handle,
    POST: handle,
    PUT: handle,
    PATCH: handle,
    DELETE: handle,
  } as const;
}

// ── RPC Handler ─────────────────────────────────────────────────────────────

export function createRpcHandlers() {
  const logger = createLogger("api-rpc");
  const handler = new RPCHandler(router, {
    plugins: [new RequestHeadersPlugin(), loggingPlugin(logger)],
  });
  return allMethods(createHandle(handler, "/api/rpc"));
}

// ── OpenAPI Handler ─────────────────────────────────────────────────────────

export type OpenAPISpec = {
  title: string;
  version: string;
  commonSchemas?: Record<
    string,
    | { schema: import("@orpc/contract").AnySchema; strategy?: "input" | "output" }
    | { error: "UndefinedError" }
  >;
};

export function createOpenApiHandlers(spec: OpenAPISpec) {
  const logger = createLogger("api-http");
  const converter = new ZodToJsonSchemaConverter();

  const handler = new OpenAPIHandler(router, {
    interceptors: [
      onError((error) => {
        logger.error({ error }, "Unhandled API error");
      }),
    ],
    plugins: [
      new SmartCoercionPlugin({ schemaConverters: [converter] }),
      loggingPlugin(logger),
      new OpenAPIReferencePlugin({
        schemaConverters: [converter],
        specGenerateOptions: {
          info: { title: spec.title, version: spec.version },
          commonSchemas: spec.commonSchemas,
        },
      }),
    ],
  });

  return allMethods(createHandle(handler, "/api"));
}
