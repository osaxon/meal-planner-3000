import { os } from "@orpc/server";
import { db } from "#/db";
import { FungiService } from "#/domains/fungi/fungi.service";
import type { BaseWideEvent } from "..";

/**
 * Provides the database and lazily-initialized service instances
 * scoped to the current request.
 */
export const serviceProvider = os
  .$context<BaseWideEvent>()
  .middleware(async ({ context, next }) => {
    let _fungiService: FungiService | undefined;

    return next({
      context: {
        db,
        get fungiService() {
          return (_fungiService ??= new FungiService(db, context.wideEvent));
        },
      },
    });
  });
