import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/** Creates a fresh in-memory SQLite database with the full app schema. */
export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(user_id, name)
    );

    CREATE TABLE meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      diet TEXT NOT NULL,
      season TEXT NOT NULL,
      produces_leftovers INTEGER NOT NULL DEFAULT 0,
      suitable_for TEXT NOT NULL DEFAULT 'any',
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE meal_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity REAL,
      unit TEXT
    );

    CREATE TABLE meal_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
      tag TEXT NOT NULL
    );

    CREATE TABLE schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      start_date INTEGER NOT NULL,
      duration_weeks INTEGER NOT NULL,
      max_leftover_meals_override INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
      date INTEGER NOT NULL,
      meal_time TEXT NOT NULL,
      type TEXT NOT NULL,
      meal_id INTEGER REFERENCES meals(id),
      source_slot_id INTEGER
    );

    CREATE TABLE household_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
      slot_config TEXT NOT NULL DEFAULT '{}',
      max_leftover_meals INTEGER NOT NULL DEFAULT 2,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE scheduling_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      subject_type TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      subject_value TEXT,
      operator TEXT NOT NULL,
      value INTEGER NOT NULL
    );

    CREATE TABLE shopping_list_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
      ingredient_key TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0,
      UNIQUE(schedule_id, ingredient_key)
    );
  `);
  return drizzle(sqlite, { schema });
}

export type TestDb = ReturnType<typeof createTestDb>;
