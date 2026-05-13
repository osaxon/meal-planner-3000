/**
 * Migration: convert existing maxMeatMeals / maxFishMeals from
 * household_preferences into user-defined Scheduling Rules.
 *
 * Run BEFORE the schema push that drops those columns.
 *
 *   vp run migrate:diet-rules
 */

import { config } from "dotenv";
import Database from "better-sqlite3";

config({ path: [".env.local", ".env"] });

const db = new Database(process.env["DATABASE_URL"]!);

type PrefRow = { user_id: string; max_meat_meals: number; max_fish_meals: number };

const prefs = db
  .prepare("SELECT user_id, max_meat_meals, max_fish_meals FROM household_preferences")
  .all() as PrefRow[];

let created = 0;
let skipped = 0;

for (const pref of prefs) {
  const migrations: Array<{ diet: string; value: number }> = [];
  if (pref.max_meat_meals > 0) migrations.push({ diet: "meat", value: pref.max_meat_meals });
  if (pref.max_fish_meals > 0) migrations.push({ diet: "fish", value: pref.max_fish_meals });

  for (const { diet, value } of migrations) {
    const existing = db
      .prepare(
        "SELECT id FROM scheduling_rules WHERE user_id = ? AND subject_type = 'diet' AND subject_value = ? AND operator = 'at_most'",
      )
      .get(pref.user_id, diet);

    if (existing) {
      console.log(`  skipped (already exists): user ${pref.user_id} — at_most ${value} ${diet}`);
      skipped++;
    } else {
      db.prepare(
        "INSERT INTO scheduling_rules (user_id, subject_type, subject_value, operator, value) VALUES (?, 'diet', ?, 'at_most', ?)",
      ).run(pref.user_id, diet, value);
      console.log(`  created: user ${pref.user_id} — at_most ${value} ${diet}`);
      created++;
    }
  }
}

console.log(`\nDone. ${created} rules created, ${skipped} already existed.`);
db.close();
