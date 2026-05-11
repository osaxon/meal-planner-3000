import type { AppDb } from "./factory";
import { createDatabase } from "./factory";

let _db: AppDb | undefined;

function getDefaultDb(): AppDb {
  if (!_db) {
    _db = createDatabase(process.env.DATABASE_URL!);
  }
  return _db;
}

/** Lazy-initialized default database. Defers connection until first access. */
export const db = new Proxy({} as AppDb, {
  get(_, prop) {
    return getDefaultDb()[prop as keyof AppDb];
  },
});
