import { pub } from "..";
import {
  listFungi,
  findFungus,
  createFungus,
  updateFungus,
  deleteFungus,
} from "#/domains/fungi/fungi.router";
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
  getShoppingList,
  toggleShoppingItem,
} from "#/domains/schedule/schedule.router";
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
  fungi: {
    list: listFungi,
    find: findFungus,
    create: createFungus,
    update: updateFungus,
    delete: deleteFungus,
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
    getShoppingList,
    toggleShoppingItem,
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
