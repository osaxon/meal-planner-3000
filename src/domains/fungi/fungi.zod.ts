import { createSelectSchema, createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { fungi } from "#/db/schema";

export const fungiSelectSchema = createSelectSchema(fungi);
export const fungiInsertSchema = createInsertSchema(fungi).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const fungiUpdateSchema = createUpdateSchema(fungi)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial();

export type Fungus = z.infer<typeof fungiSelectSchema>;
export type FungusInsert = z.infer<typeof fungiInsertSchema>;
export type FungusUpdate = z.infer<typeof fungiUpdateSchema>;
