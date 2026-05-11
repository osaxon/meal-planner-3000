import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

export type AppDb = ReturnType<typeof createDatabase>;

export function createDatabase(url: string) {
  const sqlite = new Database(url);
  return drizzle(sqlite, { schema });
}
