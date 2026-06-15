# 0005 — Use the libsql client (in-memory) for the test database

**Status:** Accepted
**Date:** 2026-06-15

## Context

Service tests run against a real in-memory SQLite database with the full app
schema (see `src/db/test-utils.ts`). The helper originally used
`better-sqlite3`, while production uses the native `@libsql/client` (ADR 0004).

The two Drizzle dialects have **incompatible transaction APIs**:

- `drizzle-orm/better-sqlite3` — `transaction((tx) => T)` is **synchronous**; the
  callback cannot be async.
- `drizzle-orm/libsql` — `transaction(async (tx) => Promise<T>)` is **async**.

Making Schedule generation atomic (#33) wraps the persistence phase in
`await db.transaction(async (tx) => …)`. A better-sqlite3 test database cannot
exercise that path faithfully, and the dialect mismatch also surfaced as
`BetterSQLite3Database is not assignable to LibSQLDatabase` type errors wherever
a test DB was passed to a service expecting `AppDb`.

## Decision

Build the test database with the same `@libsql/client` used in production, so
`TestDb` is assignable to `AppDb` and tests run the real async transaction path.

Two libsql in-memory quirks drove the configuration:

1. **Connection per transaction.** libsql opens a fresh connection when a
   transaction begins (`this.#db = null` → new `Database` on next use). A private
   `:memory:` database is per-connection, so tables vanish mid-test. Using
   `file::memory:?cache=shared` makes every connection share one in-memory DB.
2. **No named in-memory DBs.** libsql only accepts the `cache`, `tls`, and
   `authToken` URL parameters (not `mode`), so the shared in-memory database
   cannot be named and is therefore process-global. `createTestDb()` drops and
   recreates the schema on each call for isolation; Vitest runs each test file in
   its own worker and `beforeEach` resets state within a file.

`better-sqlite3` and `@types/better-sqlite3` are removed — nothing else used them.

## Consequences

- Tests cover the production transaction semantics, including rollback
  (failure-injection tests for #33) and `ON DELETE CASCADE` behaviour.
- `createTestDb()` is now `async` (libsql schema setup via `executeMultiple` is
  async); call sites `await` it.
- The shared in-memory database is process-global. Isolation relies on the
  drop-and-recreate in `createTestDb()` plus Vitest's per-file worker isolation,
  rather than a fresh database object per call.
