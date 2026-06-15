import type { MealWithCategory } from "#/domains/meals/meals.zod";

/** Tailwind dot colour per diet, shown on meal cells and the meal picker. */
export const DIET_DOT: Record<MealWithCategory["diet"], string> = {
  meat: "bg-amber-500",
  fish: "bg-sky-500",
  vegetarian: "bg-emerald-500",
};
