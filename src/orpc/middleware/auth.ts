import { ORPCError, os } from "@orpc/server";
import { auth } from "#/lib/auth";
import type { ContextWithServices } from "..";

export const authMiddleware = os
  .$context<ContextWithServices>()
  .middleware(async ({ context, next }) => {
    const session = await auth.api.getSession({
      headers: context.reqHeaders ?? new Headers(),
    });

    if (!session) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    return next({
      context: {
        session: session.session,
        user: session.user,
      },
    });
  });
