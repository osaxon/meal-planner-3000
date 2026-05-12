import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  mealWithCategorySchema,
  mealInsertSchema,
  mealUpdateSchema,
  ingredientSelectSchema,
  ingredientInsertSchema,
  ingredientUpdateSchema,
} from "./meals.zod";

export const listMealsContract = oc
  .route({ method: "GET", path: "/meals/", summary: "List all meals", tags: ["Meals"] })
  .output(z.array(mealWithCategorySchema));

export const createMealContract = oc
  .route({
    method: "POST",
    path: "/meals/",
    successStatus: 201,
    summary: "Create a meal",
    tags: ["Meals"],
  })
  .input(mealInsertSchema)
  .output(mealWithCategorySchema)
  .errors({
    CATEGORY_NOT_FOUND: { status: 404, message: "Category not found" },
  });

export const updateMealContract = oc
  .route({ method: "PATCH", path: "/meals/{id}", summary: "Update a meal", tags: ["Meals"] })
  .input(z.object({ id: z.number().int().positive() }).merge(mealUpdateSchema))
  .output(mealWithCategorySchema)
  .errors({
    NOT_FOUND: { status: 404, message: "Meal not found" },
    CATEGORY_NOT_FOUND: { status: 404, message: "Category not found" },
  });

export const deleteMealContract = oc
  .route({ method: "DELETE", path: "/meals/{id}", summary: "Delete a meal", tags: ["Meals"] })
  .input(z.object({ id: z.number().int().positive() }))
  .output(z.object({ deleted: z.boolean() }))
  .errors({
    NOT_FOUND: { status: 404, message: "Meal not found" },
  });

export const setTagsContract = oc
  .route({
    method: "PUT",
    path: "/meals/{id}/tags",
    summary: "Replace all tags on a meal",
    tags: ["Meals"],
  })
  .input(z.object({ id: z.number().int().positive(), tags: z.array(z.string().min(1).max(50)) }))
  .output(z.array(z.string()))
  .errors({ NOT_FOUND: { status: 404, message: "Meal not found" } });

const mealId = z.object({ mealId: z.number().int().positive() });

export const listIngredientsContract = oc
  .route({
    method: "GET",
    path: "/meals/{mealId}/ingredients",
    summary: "List ingredients for a meal",
    tags: ["Meals"],
  })
  .input(mealId)
  .output(z.array(ingredientSelectSchema))
  .errors({ NOT_FOUND: { status: 404, message: "Meal not found" } });

export const addIngredientContract = oc
  .route({
    method: "POST",
    path: "/meals/{mealId}/ingredients",
    successStatus: 201,
    summary: "Add an ingredient",
    tags: ["Meals"],
  })
  .input(mealId.merge(ingredientInsertSchema))
  .output(ingredientSelectSchema)
  .errors({ NOT_FOUND: { status: 404, message: "Meal not found" } });

export const updateIngredientContract = oc
  .route({
    method: "PATCH",
    path: "/meals/{mealId}/ingredients/{ingredientId}",
    summary: "Update an ingredient",
    tags: ["Meals"],
  })
  .input(
    mealId
      .merge(z.object({ ingredientId: z.number().int().positive() }))
      .merge(ingredientUpdateSchema),
  )
  .output(ingredientSelectSchema)
  .errors({ NOT_FOUND: { status: 404, message: "Ingredient not found" } });

export const deleteIngredientContract = oc
  .route({
    method: "DELETE",
    path: "/meals/{mealId}/ingredients/{ingredientId}",
    summary: "Delete an ingredient",
    tags: ["Meals"],
  })
  .input(mealId.merge(z.object({ ingredientId: z.number().int().positive() })))
  .output(z.object({ deleted: z.boolean() }))
  .errors({ NOT_FOUND: { status: 404, message: "Ingredient not found" } });
