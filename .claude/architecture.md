---
inclusion: auto
description: Full-stack architecture guide — oRPC contract-first API design, domain-based project structure, middleware chain, service patterns, Drizzle ORM setup, wide-event logging, and testing strategy for a TanStack Start app
---

# Architecture Guide

This project is a reusable template: oRPC + TanStack Start + Drizzle ORM + SQLite. Follow the existing `meals` domain as the reference implementation for all new features.

## Stack

oRPC (contract-first RPC), TanStack Start (React SSR), TanStack Router (file-based), TanStack Query via `@orpc/tanstack-query`, Zod v4, Drizzle ORM (better-sqlite3), Vitest. Uses `vp` CLI for all tooling — never call npm/pnpm/yarn directly.

## Path Aliases

Use `#/` for all imports (maps to `src/`). Within a domain folder, use relative imports for sibling files (e.g. `./meals.zod`).

## Project Structure

Domain-first layout. Each domain co-locates its zod schemas, contract, service, and router. Shared infrastructure stays in `orpc/`, `db/`, and `lib/`.

```
src/
├── domains/{domain}/
│   ├── {domain}.zod.ts         # Zod schemas (derived from Drizzle)
│   ├── {domain}.contract.ts    # oRPC contracts
│   ├── {domain}.service.ts     # Business logic + domain errors
│   ├── {domain}.router.ts      # Route handlers (thin adapter to service)
│   └── __tests__/              # Domain-specific tests
├── orpc/
│   ├── index.ts                # Context types, middleware chain, auth tiers
│   ├── handler-factory.ts      # Shared RPC + OpenAPI handler creation
│   ├── contracts/index.ts      # Assembles all domain contracts into tree
│   ├── router/root.ts          # Assembles all domain routers
│   └── middleware/              # Shared middleware (logging, auth, services)
├── db/
│   ├── schema.ts               # Drizzle table definitions (all domains)
│   ├── factory.ts              # Database factory
│   └── index.ts                # Default DB with lazy proxy
├── lib/                        # Shared utilities (logger, auth, wide-event)
└── routes/                     # TanStack Router file-based routes
```

## Adding a New Domain

Follow these steps in order. Reference `src/domains/meals/` as the example.

### 1. Schema — `src/db/schema.ts`

Define the Drizzle table. Use `integer("created_at", { mode: "timestamp" }).default(sql\`(unixepoch())\`)`for timestamps. All domain tables live in this shared file (split to`src/db/schema/` when it grows).

### 2. Zod Schemas — `src/domains/{domain}/{domain}.zod.ts`

Derive from Drizzle using `drizzle-zod`. Always create select, insert (omit id/timestamps), and update (omit id/timestamps, partial) schemas. Export `type` aliases via `z.infer`.

```ts
export const itemSelectSchema = createSelectSchema(items);
export const itemInsertSchema = createInsertSchema(items).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const itemUpdateSchema = createUpdateSchema(items)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial();
export type Item = z.infer<typeof itemSelectSchema>;
```

### 3. Contract — `src/domains/{domain}/{domain}.contract.ts`

Define one contract per operation using `oc.route()`. Import schemas from the sibling zod file (`./items.zod`). Specify method, path, summary, tags, input/output schemas, and `.errors()` for expected failures. Then add the contracts to the tree in `src/orpc/contracts/index.ts`.

### 4. Service — `src/domains/{domain}/{domain}.service.ts`

Class-based, receives `AppDb` and optionally `EventCollector<"domain">` via constructor. Import types from the sibling zod file. Contains all business logic, data access, and domain invariant enforcement.

Services use the result pattern for expected failures — returning `Result<T, DomainError<Code>>` (from `src/lib/result.ts`) instead of throwing. Error codes are plain string literals matching the contract's `.errors()` keys, carried in a lightweight `DomainError<Code>` type (just `{ code, message }`). No error classes needed.

Each service defines two type aliases at the top — `Name` (the domain string) and `Events` (a union of domain-specific event actions beyond CRUD). These are used to parameterize `EventCollector<Name, Events>` so the types are declared once and reused in the constructor and field:

```ts
type Name = "orders";
type Events = "payment_failed" | "refund_issued";

type NotFound = DomainError<"NOT_FOUND">;

export class OrderService {
  private readonly events: EventCollector<Name, Events>;

  constructor(
    private readonly db: AppDb,
    events?: EventCollector<Name, Events>,
  ) {
    this.events = events ?? noopCollector;
  }

  async update(id: number, input: OrderUpdate): Promise<Result<Order, NotFound>> {
    // ...
    if (!row) return err({ code: "NOT_FOUND", message: `Order ${id} not found` });
    return ok(row);
  }
}
```

Use `this.events.addDetail(...)` to enrich the per-request wide event. The `EventCollector` interface (from `src/lib/wide-event.ts`) is the narrow seam services depend on — not the concrete `WideEvent` class. When omitted, the constructor falls back to `noopCollector`. Services do not have their own Pino loggers.

### 5. Register in Middleware — `src/orpc/middleware/service-provider.ts`

Add a lazy getter for the new service. The service provider also injects `db` — there is no separate db-provider middleware. Pass `context.wideEvent` from the logging middleware:

```ts
let _itemService: ItemService | undefined;

return next({
  context: {
    db,
    get itemService() {
      return (_itemService ??= new ItemService(db, context.wideEvent));
    },
    // ... existing services
  },
});
```

Also add the service type to `ContextWithServices` in `src/orpc/index.ts`.

### 6. Router — `src/domains/{domain}/{domain}.router.ts`

Import `pub` (or `authed`/`admin`) from `#/orpc`. Handlers are thin adapters: they call service methods and throw `ORPCError` when the result is not ok. Since `DomainError.code` matches the contract error codes directly, a single `fail()` helper handles all domains — no per-domain mapping function needed. Then add the handlers to `src/orpc/router/root.ts`.

```ts
function fail(error: DomainError): never {
  throw new ORPCError(error.code);
}

export const createMeal = pub.meals.create.handler(async ({ input, context }) => {
  const result = await context.mealService.create(input);
  if (!result.ok) fail(result.error);
  return result.value;
});
```

### 7. Frontend Route — `src/routes/{path}.tsx`

Use `orpc.{domain}.{method}.queryOptions()` in both the route loader and `useSuspenseQuery` for SSR + client hydration.

## Middleware Chain

Defined in `src/orpc/index.ts`. Context is progressively enriched:

`BaseContext` → (loggingMiddleware) → `BaseWideEvent` → (serviceProvider) → `ContextWithServices`

The `serviceProvider` injects both the database and all lazy service instances in a single step. There is no separate db-provider middleware.

Auth tiers can be added by chaining `.use(authMiddleware)` after `pub`.

## Database

- Factory: `src/db/factory.ts` — `createDatabase(url)` returns a typed Drizzle instance
- Default: `src/db/index.ts` — lazy Proxy, defers connection until first access
- Push schema: `vp exec drizzle-kit push --force`

## Error Handling

Define expected errors in contracts with status codes. Services return `Result<T, DomainError<Code>>` for expected failures using `ok()` and `err()` from `src/lib/result.ts`. Domain error codes are plain string literals that match the contract's `.errors()` keys directly. Router handlers check `result.ok` and throw `ORPCError(error.code)` on the failure branch. Reserve `throw` for truly unexpected failures (infrastructure errors, programming bugs).

### Result Type — `src/lib/result.ts`

A discriminated union that TypeScript narrows automatically:

```ts
type Result<T, E = Error> = Ok<T> | Err<E>;
type DomainError<Code extends string = string> = { readonly code: Code; readonly message: string };

const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
const err = <E>(error: E): Err<E> => ({ ok: false, error });
```

After `if (result.ok)`, TypeScript knows `result.value` is `T`. After `if (!result.ok)`, it knows `result.error` is `E`. No class ceremony, no `getValue()` / `getError()` methods.

## Handler Factory

`src/orpc/handler-factory.ts` centralizes RPC and OpenAPI handler creation. Both `api.rpc.$.ts` and `api.$.ts` route files are thin wrappers that call `createRpcHandlers()` or `createOpenApiHandlers(spec)`. All shared concerns (logger creation, `LoggingHandlerPlugin`, `RequestHeadersPlugin`, route-method mapping) live in the factory.

## OpenAPI

Auto-generated at `/api/docs`. Register common schemas in `src/routes/api.$.ts` via the `commonSchemas` option passed to `createOpenApiHandlers()`.

## Testing

- Service tests: in-memory SQLite, real queries, clean state in `beforeEach`. Located in `src/domains/{domain}/__tests__/`
- Router tests: mock services via `vi.hoisted()` + `vi.mock()`, call routes with `call()` from `@orpc/server`. Located in `src/domains/{domain}/__tests__/`
- Component tests: mock auth client and services, render with `@testing-library/react`, assert on DOM
- Use standard Vitest unit tests — no property-based testing (fast-check) unless explicitly requested
- Run: `vp test run`

## Logging

Pino handles handler-level request lifecycle logging via `LoggingHandlerPlugin`. Services use a Stripe-style wide event for per-request telemetry — no per-service Pino loggers.

### Root Logger — `src/lib/logger.ts`

Single Pino instance. Dev: pino-pretty to console + file (`logs/output.log`). Production: JSON to stdout. Exports:

- `logger` — root instance
- `createLogger(module)` — top-level child (for API handlers, scripts)

`createModuleLogger` is available but not used in services — it exists for standalone scripts or tools that need hierarchical logging outside the oRPC chain.

### Wide Event — `src/lib/wide-event.ts`

A `WideEvent<D, Extra>` class accumulates structured data throughout a request and is emitted as a single log entry when the request completes. It implements the `EventCollector<D, Extra>` interface.

#### EventCollector Interface

Services depend on `EventCollector<D, Extra>` — a narrow interface with just `addDetail()` and `markFailed()`. This decouples services from the concrete `WideEvent` class. A `noopCollector` is exported for tests or contexts where event collection is unnecessary.

```ts
// The interface services depend on:
type EventCollector<D, Extra> = {
  addDetail(key: EventKey<D, Extra>, value: unknown): void;
  markFailed(code: string, message: string): void;
};
```

Two generics control type-safe event keys:

- `D` — the domain string (e.g. `"shopping-list"`). Provides autocomplete for CRUD actions: `"shopping-list.created"`, `"shopping-list.updated"`, `"shopping-list.deleted"`.
- `Extra` — optional union of domain-specific action strings (e.g. `"item_toggled"`). Adds `"shopping-list.item_toggled"` to the allowed keys.

When neither generic is provided (default `string`), any `"domain.action"` string is accepted — this is what the middleware uses.

Full `WideEvent` API (superset of `EventCollector`):

- `set(key, value)` — set a top-level property
- `addDetail(key, value)` — append a structured detail with a typed `EventKey<D, Extra>`
- `markFailed(code, message)` — mark the event as failed (called automatically by the middleware on errors)
- `toJSON()` — serialize for logging

### Logging Middleware — `src/orpc/middleware/logging.ts`

Creates the `WideEvent` (unparameterized, accepts any domain) at request start, passes it via `context.wideEvent`, and emits it once after the handler completes. Wraps `next()` in try/catch to capture both success and error outcomes with timing.

Position in the middleware chain: first after `implement(contract)`, before `serviceProvider`.

### Wide Event in Services

Services depend on `EventCollector<Name, Events>` — the narrow interface, not the concrete `WideEvent` class. No Pino logger — the event collector is the service's only observability interface.

Each service defines `Name` and `Events` type aliases at the top and uses them to parameterize the collector:

```ts
type Name = "shopping-list";
type Events = "item_toggled";

export class ShoppingListService {
  private readonly events: EventCollector<Name, Events>;
  // Autocompletes: "shopping-list.created" | "shopping-list.updated" | "shopping-list.deleted" | "shopping-list.item_toggled"
```

For CRUD-only domains, omit the `Events` type:

```ts
type Name = "items";

export class ItemService {
  private readonly events: EventCollector<Name>;
  // Autocompletes: "items.created" | "items.updated" | "items.deleted"
```

The constructor accepts `EventCollector` as optional and falls back to `noopCollector`:

```ts
constructor(db: AppDb, events?: EventCollector<Name, Events>) {
  this.events = events ?? noopCollector;
}
```

No central registry of domains or events. Each service defines its own scope via the `Name` and `Events` aliases.

### Wide Event in Service Provider

Pass `context.wideEvent` to service constructors alongside `db`:

```ts
get itemService() {
  return (_itemService ??= new ItemService(db, context.wideEvent));
}
```

### Request Logging

`LoggingHandlerPlugin` from `@orpc/experimental-pino` handles request lifecycle logging at the handler level. Both RPC and OpenAPI handlers get this plugin via `src/orpc/handler-factory.ts`. The wide event middleware adds the single summary event on top of this.

### Testing

Wide event in tests: either omit it (constructor falls back to `noopCollector`) or pass a real `new WideEvent("test")` and assert on `toJSON()` if you want to verify event enrichment. No mock logger needed for services.

## Conventions

- `type` over `interface`
- Let functions infer return types
- Domain files use `{domain}.{role}.ts` naming (e.g. `meals.service.ts`, `meals.zod.ts`, `meals.contract.ts`, `meals.router.ts`)
- Within a domain folder, use relative imports for sibling files; use `#/` aliases for everything outside the domain
- kebab-case for folder names, PascalCase for classes, camelCase for everything else
- Drizzle tables stay in `src/db/schema.ts` (split to `src/db/schema/` when it grows)
