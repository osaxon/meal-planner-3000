import { oc } from "@orpc/contract";
import { z } from "zod";
import { categorySelectSchema, categoryInsertSchema } from "./categories.zod";

export const listCategoriesContract = oc
  .route({
    method: "GET",
    path: "/categories/",
    summary: "List all categories",
    tags: ["Categories"],
  })
  .output(z.array(categorySelectSchema));

export const createCategoryContract = oc
  .route({
    method: "POST",
    path: "/categories/",
    successStatus: 201,
    summary: "Create a category",
    tags: ["Categories"],
  })
  .input(categoryInsertSchema)
  .output(categorySelectSchema)
  .errors({
    DUPLICATE: { status: 409, message: "A category with that name already exists" },
  });

export const renameCategoryContract = oc
  .route({
    method: "PATCH",
    path: "/categories/{id}",
    summary: "Rename a category",
    tags: ["Categories"],
  })
  .input(z.object({ id: z.number().int().positive(), name: z.string().min(1).max(100) }))
  .output(categorySelectSchema)
  .errors({
    NOT_FOUND: { status: 404, message: "Category not found" },
    DUPLICATE: { status: 409, message: "A category with that name already exists" },
  });

export const deleteCategoryContract = oc
  .route({
    method: "DELETE",
    path: "/categories/{id}",
    summary: "Delete a category",
    tags: ["Categories"],
  })
  .input(z.object({ id: z.number().int().positive() }))
  .output(z.object({ deleted: z.boolean() }))
  .errors({
    NOT_FOUND: { status: 404, message: "Category not found" },
    HAS_MEALS: { status: 409, message: "Category has associated meals and cannot be deleted" },
  });
