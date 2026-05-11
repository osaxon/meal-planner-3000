import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const fungi = sqliteTable("fungi", {
  id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  commonName: text("common_name").notNull(),
  scientificName: text("scientific_name").notNull().unique(),
  habitat: text().notNull(),
  edible: integer({ mode: "boolean" }).notNull().default(false),
  description: text(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export * from "./auth-schema";
