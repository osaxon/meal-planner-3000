import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { categories } from "#/db/schema";

export const categorySelectSchema = createSelectSchema(categories);
export const categoryInsertSchema = createInsertSchema(categories)
  .omit({ id: true, userId: true, createdAt: true, updatedAt: true })
  .extend({ name: z.string().min(1).max(100) });

export type Category = z.infer<typeof categorySelectSchema>;
export type CategoryInsert = z.infer<typeof categoryInsertSchema>;
