import {
  listFungiContract,
  findFungusContract,
  createFungusContract,
  updateFungusContract,
  deleteFungusContract,
} from "#/domains/fungi/fungi.contract";
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
  getShoppingListContract,
  toggleShoppingItemContract,
} from "#/domains/schedule/schedule.contract";
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
  fungi: {
    list: listFungiContract,
    find: findFungusContract,
    create: createFungusContract,
    update: updateFungusContract,
    delete: deleteFungusContract,
  },
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
    getShoppingList: getShoppingListContract,
    toggleShoppingItem: toggleShoppingItemContract,
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
