import { os } from "@orpc/server";
import { db } from "#/db";
import { CategoryService } from "#/domains/categories/categories.service";
import { PreferencesService } from "#/domains/preferences/preferences.service";
import { MealService } from "#/domains/meals/meals.service";
import { ScheduleService } from "#/domains/schedule/schedule.service";
import { ShoppingListService } from "#/domains/shopping-list/shopping-list.service";
import { RulesService } from "#/domains/rules/rules.service";
import type { BaseWideEvent } from "..";

/**
 * Provides the database and lazily-initialized service instances
 * scoped to the current request.
 */
export const serviceProvider = os
  .$context<BaseWideEvent>()
  .middleware(async ({ context, next }) => {
    let _categoryService: CategoryService | undefined;
    let _preferencesService: PreferencesService | undefined;
    let _mealService: MealService | undefined;
    let _scheduleService: ScheduleService | undefined;
    let _shoppingListService: ShoppingListService | undefined;
    let _rulesService: RulesService | undefined;

    return next({
      context: {
        db,
        get categoryService() {
          return (_categoryService ??= new CategoryService(db, context.wideEvent));
        },
        get preferencesService() {
          return (_preferencesService ??= new PreferencesService(db, context.wideEvent));
        },
        get mealService() {
          return (_mealService ??= new MealService(db, context.wideEvent));
        },
        get scheduleService() {
          return (_scheduleService ??= new ScheduleService(
            db,
            this.preferencesService,
            context.wideEvent,
          ));
        },
        get shoppingListService() {
          return (_shoppingListService ??= new ShoppingListService(
            db,
            this.scheduleService,
            context.wideEvent,
          ));
        },
        get rulesService() {
          return (_rulesService ??= new RulesService(db, context.wideEvent));
        },
      },
    });
  });
