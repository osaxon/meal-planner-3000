import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Creates a fresh in-memory database with the full app schema.
 *
 * Uses the same libsql client as production (ADR 0004, 0005) so tests run the
 * real async transaction path — `db.transaction(async (tx) => …)` — rather than
 * better-sqlite3's synchronous dialect. `TestDb` is therefore assignable to
 * `AppDb`. Async because libsql schema setup (`executeMultiple`) is async.
 *
 * libsql opens a fresh connection per transaction, so a private `:memory:` DB
 * (one DB per connection) loses its tables mid-test. `cache=shared` makes all
 * connections share one in-memory DB. That DB is process-global and libsql
 * can't name it, so we drop-and-recreate the schema on each call for isolation;
 * Vitest runs each test file in its own worker, and `beforeEach` resets within.
 */
export async function createTestDb() {
  const client = createClient({ url: "file::memory:?cache=shared" });
  await client.executeMultiple(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS shopping_list_checks;
    DROP TABLE IF EXISTS scheduling_rules;
    DROP TABLE IF EXISTS household_preferences;
    DROP TABLE IF EXISTS slots;
    DROP TABLE IF EXISTS schedules;
    DROP TABLE IF EXISTS meal_tags;
    DROP TABLE IF EXISTS meal_ingredients;
    DROP TABLE IF EXISTS meals;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS user;

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
      day_availability TEXT NOT NULL DEFAULT 'any',
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
      value INTEGER NOT NULL,
      scope TEXT NOT NULL DEFAULT 'per_schedule'
    );

    CREATE TABLE shopping_list_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
      ingredient_key TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0,
      UNIQUE(schedule_id, ingredient_key)
    );

    PRAGMA foreign_keys = ON;
  `);
  return drizzle(client, { schema });
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
