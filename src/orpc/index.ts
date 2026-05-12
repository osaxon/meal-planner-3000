import { implement } from "@orpc/server";
import { contract } from "./contracts";
import { authMiddleware } from "./middleware/auth";
import { serviceProvider } from "./middleware/service-provider";
import { loggingMiddleware } from "./middleware/logging";

import type { LoggerContext } from "@orpc/experimental-pino";
import type { AppDb } from "#/db/factory";
import type { AuthSession, AuthUser } from "#/lib/auth";
import type { FungiService } from "#/domains/fungi/fungi.service";
import type { CategoryService } from "#/domains/categories/categories.service";
import type { PreferencesService } from "#/domains/preferences/preferences.service";
import type { MealService } from "#/domains/meals/meals.service";
import type { ScheduleService } from "#/domains/schedule/schedule.service";
import type { RulesService } from "#/domains/rules/rules.service";
import type { EventCollector } from "#/lib/wide-event";

/** Base context provided by the RPC handler (includes logger from LoggingHandlerPlugin). */
export type BaseContext = LoggerContext & {
  reqHeaders?: Headers;
};

/** Context after logging middleware — includes the wide event accumulator. */
export type BaseWideEvent = BaseContext & {
  wideEvent: EventCollector<string, string>;
};

/** Context after service-provider middleware — includes db and all services. */
export type ContextWithServices = BaseWideEvent & {
  db: AppDb;
  fungiService: FungiService;
  categoryService: CategoryService;
  preferencesService: PreferencesService;
  mealService: MealService;
  scheduleService: ScheduleService;
  rulesService: RulesService;
};

/**
 * Public tier: logging → services (db + services injected together).
 * All routes in this template are public. Add auth middleware here when needed.
 */
export const pub = implement(contract)
  .$context<BaseContext>()
  .use(loggingMiddleware)
  .use(serviceProvider);

/** Context after auth middleware — includes session and user. */
export type AuthenticatedContext = ContextWithServices & {
  session: AuthSession;
  user: AuthUser;
};

/** Authenticated tier: pub + auth middleware. */
export const authed = pub.use(authMiddleware);
