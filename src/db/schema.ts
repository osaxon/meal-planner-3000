import { sqliteTable, integer, text, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";

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

export const categories = sqliteTable(
  "categories",
  {
    id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("categories_user_name_unique").on(t.userId, t.name)],
);

export const meals = sqliteTable("meals", {
  id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text().notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id),
  diet: text({ enum: ["meat", "fish", "vegetarian"] }).notNull(),
  season: text({
    enum: ["year_round", "spring_summer", "autumn_winter", "festive", "bbq"],
  }).notNull(),
  producesLeftovers: integer("produces_leftovers", { mode: "boolean" }).notNull().default(false),
  suitableFor: text("suitable_for", { enum: ["lunch", "dinner", "any"] })
    .notNull()
    .default("any"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const mealIngredients = sqliteTable("meal_ingredients", {
  id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  mealId: integer("meal_id")
    .notNull()
    .references(() => meals.id, { onDelete: "cascade" }),
  name: text().notNull(),
  quantity: real(),
  unit: text(),
});

export const mealTags = sqliteTable("meal_tags", {
  id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  mealId: integer("meal_id")
    .notNull()
    .references(() => meals.id, { onDelete: "cascade" }),
  tag: text().notNull(),
});

export const schedules = sqliteTable("schedules", {
  id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text({ enum: ["active", "previous"] }).notNull(),
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  durationWeeks: integer("duration_weeks", { mode: "number" }).notNull(),
  maxMeatMealsOverride: integer("max_meat_meals_override", { mode: "number" }),
  maxFishMealsOverride: integer("max_fish_meals_override", { mode: "number" }),
  maxLeftoverMealsOverride: integer("max_leftover_meals_override", { mode: "number" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const slots = sqliteTable("slots", {
  id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  scheduleId: integer("schedule_id")
    .notNull()
    .references(() => schedules.id, { onDelete: "cascade" }),
  date: integer({ mode: "timestamp" }).notNull(),
  mealTime: text("meal_time", { enum: ["lunch", "dinner"] }).notNull(),
  type: text({ enum: ["filled", "leftover", "empty"] }).notNull(),
  mealId: integer("meal_id").references(() => meals.id),
  sourceSlotId: integer("source_slot_id"),
});

export const householdPreferences = sqliteTable("household_preferences", {
  id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  slotConfig: text("slot_config").notNull().default("{}"),
  maxLeftoverMeals: integer("max_leftover_meals", { mode: "number" }).notNull().default(2),
  maxMeatMeals: integer("max_meat_meals", { mode: "number" }).notNull().default(4),
  maxFishMeals: integer("max_fish_meals", { mode: "number" }).notNull().default(2),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const schedulingRules = sqliteTable("scheduling_rules", {
  id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  subjectType: text("subject_type", { enum: ["category", "tag", "diet"] }).notNull(),
  // Set for category rules; cascade-deletes the rule when the category is deleted
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "cascade" }),
  // Set for tag and diet rules; null for category rules
  subjectValue: text("subject_value"),
  operator: text("operator", { enum: ["at_most", "at_least"] }).notNull(),
  value: integer({ mode: "number" }).notNull(),
});

export const shoppingListChecks = sqliteTable(
  "shopping_list_checks",
  {
    id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    scheduleId: integer("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    ingredientKey: text("ingredient_key").notNull(),
    checked: integer({ mode: "boolean" }).notNull().default(false),
  },
  (t) => [uniqueIndex("slc_schedule_key_unique").on(t.scheduleId, t.ingredientKey)],
);

export * from "./auth-schema";
