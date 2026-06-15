import {
  listCategoriesContract,
  createCategoryContract,
  renameCategoryContract,
  deleteCategoryContract,
} from "#/domains/categories/categories.contract";
import {
  getPreferencesContract,
  updatePreferencesContract,
} from "#/domains/preferences/preferences.contract";
import {
  generateScheduleContract,
  getActiveScheduleContract,
  updateSlotContract,
} from "#/domains/schedule/schedule.contract";
import {
  listShoppingListContract,
  toggleShoppingItemContract,
} from "#/domains/shopping-list/shopping-list.contract";
import {
  listRulesContract,
  createRuleContract,
  updateRuleContract,
  deleteRuleContract,
} from "#/domains/rules/rules.contract";
import {
  listMealsContract,
  createMealContract,
  updateMealContract,
  deleteMealContract,
  setTagsContract,
  listIngredientsContract,
  addIngredientContract,
  updateIngredientContract,
  deleteIngredientContract,
} from "#/domains/meals/meals.contract";

export const contract = {
  categories: {
    list: listCategoriesContract,
    create: createCategoryContract,
    rename: renameCategoryContract,
    delete: deleteCategoryContract,
  },
  preferences: {
    get: getPreferencesContract,
    update: updatePreferencesContract,
  },
  schedule: {
    generate: generateScheduleContract,
    getActive: getActiveScheduleContract,
    updateSlot: updateSlotContract,
  },
  shoppingList: {
    list: listShoppingListContract,
    toggle: toggleShoppingItemContract,
  },
  rules: {
    list: listRulesContract,
    create: createRuleContract,
    update: updateRuleContract,
    delete: deleteRuleContract,
  },
  meals: {
    list: listMealsContract,
    create: createMealContract,
    update: updateMealContract,
    delete: deleteMealContract,
    setTags: setTagsContract,
    ingredients: {
      list: listIngredientsContract,
      add: addIngredientContract,
      update: updateIngredientContract,
      delete: deleteIngredientContract,
    },
  },
};
