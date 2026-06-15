import { createDatabase, type AppDb } from "./factory";

let instance: AppDb | undefined;

/**
 * Lazy database proxy: defers `createDatabase()` — and thus reading env and
 * opening the libsql client — until the first property access. This keeps
 * importing `#/db` side-effect free, so code paths that never touch the
 * database (e.g. router tests with mocked services) don't require connection
 * env. Methods are bound to the real instance so drizzle's `this` is correct.
 */
export const db: AppDb = new Proxy({} as AppDb, {
  get(_target, prop, receiver) {
    const real = (instance ??= createDatabase());
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
