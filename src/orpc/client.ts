import { createRouterClient } from "@orpc/server";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { CONTEXT_LOGGER_SYMBOL } from "@orpc/experimental-pino";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { createIsomorphicFn } from "@tanstack/react-start";

import type { RouterClient } from "@orpc/server";

import { createLogger } from "#/lib/logger";
import router from "#/orpc/router/root";

const serverLogger = createLogger("orpc-server");

const getORPCClient = createIsomorphicFn()
  .server(() =>
    createRouterClient(router, {
      context: () => {
        const requestId = crypto.randomUUID();
        const requestLogger = serverLogger.child({
          rpc: { id: requestId, system: "orpc" },
        });
        return {
          reqHeaders: getRequestHeaders(),
          [CONTEXT_LOGGER_SYMBOL]: requestLogger,
        };
      },
    }),
  )
  .client((): RouterClient<typeof router> => {
    const link = new RPCLink({
      url: `${window.location.origin}/api/rpc`,
    });
    return createORPCClient(link);
  });

export const client: RouterClient<typeof router> = getORPCClient();

export const orpc = createTanstackQueryUtils(client);
