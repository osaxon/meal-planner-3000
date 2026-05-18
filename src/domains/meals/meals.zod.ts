import { createSelectSchema, createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { meals, mealIngredients } from "#/db/schema";

export const mealSelectSchema = createSelectSchema(meals);
export const mealInsertSchema = createInsertSchema(meals)
  .omit({ id: true, userId: true, createdAt: true, updatedAt: true })
  .extend({ name: z.string().min(1).max(200) });
export const mealUpdateSchema = createUpdateSchema(meals)
  .omit({ id: true, userId: true, createdAt: true, updatedAt: true })
  .partial()
  .extend({ name: z.string().min(1).max(200).optional() });

export const mealWithCategorySchema = mealSelectSchema.extend({
  categoryName: z.string(),
  tags: z.array(z.string()),
});

export type Meal = z.infer<typeof mealSelectSchema>;
export type MealWithCategory = z.infer<typeof mealWithCategorySchema>;
export type MealInsert = z.infer<typeof mealInsertSchema>;
export type MealUpdate = z.infer<typeof mealUpdateSchema>;

export const ingredientSelectSchema = createSelectSchema(mealIngredients);
export const ingredientInsertSchema = createInsertSchema(mealIngredients)
  .omit({ id: true, mealId: true })
  .extend({ name: z.string().min(1).max(200) });
export const ingredientUpdateSchema = createUpdateSchema(mealIngredients)
  .omit({ id: true, mealId: true })
  .partial()
  .extend({ name: z.string().min(1).max(200).optional() });

export type Ingredient = z.infer<typeof ingredientSelectSchema>;
export type IngredientInsert = z.infer<typeof ingredientInsertSchema>;
export type IngredientUpdate = z.infer<typeof ingredientUpdateSchema>;

export const SUITABLE_FOR_LABELS: Record<Meal["suitableFor"], string> = {
  lunch: "Lunch only",
  dinner: "Dinner only",
  any: "Lunch or dinner",
};

export const DAY_AVAILABILITY_LABELS: Record<Meal["dayAvailability"], string> = {
  any: "Any day",
  weekdays_only: "Weekdays only",
  weekends_only: "Weekends only",
};

export const DIET_LABELS: Record<Meal["diet"], string> = {
  meat: "Meat",
  fish: "Fish",
  vegetarian: "Vegetarian",
};

export const SEASON_LABELS: Record<Meal["season"], string> = {
  year_round: "Year Round",
  spring_summer: "Spring / Summer",
  autumn_winter: "Autumn / Winter",
  festive: "Festive",
  bbq: "BBQ",
};
