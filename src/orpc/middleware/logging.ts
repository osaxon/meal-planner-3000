import { getLogger } from "@orpc/experimental-pino";
import { ORPCError, os } from "@orpc/server";
import { WideEvent } from "#/lib/wide-event";
import type { BaseContext } from "..";

/**
 * Creates a WideEvent at the start of the request, passes it through context,
 * and emits it as a single structured log entry once the request completes.
 *
 * Services and downstream middleware enrich the event via `context.wideEvent`.
 */
export const loggingMiddleware = os
  .$context<BaseContext>()
  .middleware(async ({ context, next }) => {
    const logger = getLogger(context);
    const requestId = context.reqHeaders?.get("x-request-id") ?? crypto.randomUUID();
    const event = new WideEvent(requestId);

    const start = performance.now();

    try {
      const result = await next({
        context: {
          get wideEvent() {
            return event;
          },
        },
      });

      event.setDuration(performance.now() - start);
      logger?.info({ wide_event: event.toJSON() }, "request.completed");

      return result;
    } catch (error) {
      event.setDuration(performance.now() - start);

      if (error instanceof ORPCError) {
        event.markFailed(error.code, error.message);
      } else if (error instanceof Error) {
        event.markFailed("INTERNAL_SERVER_ERROR", error.message);
      } else {
        event.markFailed("INTERNAL_SERVER_ERROR", "Unknown error");
      }

      logger?.error({ wide_event: event.toJSON() }, "request.failed");

      throw error;
    }
  });
