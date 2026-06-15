import { pub } from "..";
import { listRules, createRule, updateRule, deleteRule } from "#/domains/rules/rules.router";
import {
  listCategories,
  createCategory,
  renameCategory,
  deleteCategory,
} from "#/domains/categories/categories.router";
import { getPreferences, updatePreferences } from "#/domains/preferences/preferences.router";
import {
  generateSchedule,
  getActiveSchedule,
  updateSlot,
} from "#/domains/schedule/schedule.router";
import { listShoppingList, toggleShoppingItem } from "#/domains/shopping-list/shopping-list.router";
import {
  listMeals,
  createMeal,
  updateMeal,
  deleteMeal,
  setTags,
  listIngredients,
  addIngredient,
  updateIngredient,
  deleteIngredient,
} from "#/domains/meals/meals.router";

const router = pub.router({
  rules: {
    list: listRules,
    create: createRule,
    update: updateRule,
    delete: deleteRule,
  },
  categories: {
    list: listCategories,
    create: createCategory,
    rename: renameCategory,
    delete: deleteCategory,
  },
  preferences: {
    get: getPreferences,
    update: updatePreferences,
  },
  schedule: {
    generate: generateSchedule,
    getActive: getActiveSchedule,
    updateSlot,
  },
  shoppingList: {
    list: listShoppingList,
    toggle: toggleShoppingItem,
  },
  meals: {
    list: listMeals,
    create: createMeal,
    update: updateMeal,
    delete: deleteMeal,
    setTags,
    ingredients: {
      list: listIngredients,
      add: addIngredient,
      update: updateIngredient,
      delete: deleteIngredient,
    },
  },
});

export default router;
