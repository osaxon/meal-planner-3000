# Logging Architecture Guide

How request-level telemetry works across the application using a Stripe-style wide event system, with Pino handling handler-level lifecycle logging.

## Stack

| Component         | Technology               |
| ----------------- | ------------------------ |
| Logger            | Pino                     |
| Dev formatting    | pino-pretty              |
| oRPC integration  | @orpc/experimental-pino  |
| Request telemetry | Custom `WideEvent` class |

## Design Decisions

1. **No per-service Pino loggers.** All request-level observability flows through the `WideEvent`. Pino is used at the handler level only (`LoggingHandlerPlugin`) for request lifecycle logging and wide event emission.

2. **No central domain registry.** Event key types are scoped per-service via generics, not a shared union. Adding a new domain doesn't require updating a central type file.

3. **Type-safe event keys with autocomplete.** `WideEvent<D, Extra>` uses template literal types to provide autocomplete for CRUD actions and optional domain-specific events, while keeping the system open-ended.

---

## 1. Root Logger — `src/lib/logger.ts`

A single root Pino instance. In development, it outputs to both the console (pretty-printed) and a log file. In production, plain JSON to stdout.

```ts
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isDev
    ? {
        targets: [
          { target: "pino-pretty", options: { colorize: true } },
          { target: "pino/file", options: { destination: "logs/output.log", mkdir: true } },
        ],
      }
    : undefined,
});

export const createLogger = (module: string) => logger.child({ module });
```

`createLogger` is used by API handler entry points (`api.$.ts`) to create handler-scoped loggers. `createModuleLogger` exists for standalone scripts but is not used in services.

---

## 2. Wide Event System

### EventKey Type — `src/lib/wide-event.ts`

```ts
type CrudAction = "created" | "updated" | "deleted";

export type EventKey<D extends string = string, Extra extends string = never> =
  | `${D}.${CrudAction}`
  | `${D}.${Extra}`;
```

Two generics:

- `D` — domain string. Provides CRUD autocomplete: `"fungi.created"`, `"fungi.updated"`, `"fungi.deleted"`.
- `Extra` — optional union of domain-specific actions. Adds keys like `"fungi.spore_analyzed"`.

When `D` defaults to `string` (middleware usage), any `"domain.action"` is accepted.

### WideEvent Class

```ts
export class WideEvent<D extends string = string, Extra extends string = never> {
  set(key: string, value: unknown): void;
  addDetail(key: EventKey<D, Extra>, value: unknown): void;
  markFailed(code: string, message: string): void;
  setDuration(ms: number): void;
  toJSON(): Record<string, unknown>;
}
```

### Logging Middleware — `src/orpc/middleware/logging.ts`

Creates the `WideEvent` (unparameterized) at request start, passes it through `context.wideEvent`, and emits it once after the handler completes. Wraps `next()` in try/catch to capture both outcomes.

```ts
export const loggingMiddleware = os
  .$context<BaseContext>()
  .middleware(async ({ context, next }) => {
    const logger = getLogger(context);
    const requestId = context.reqHeaders?.get("x-request-id") ?? crypto.randomUUID();
    const event = new WideEvent(requestId);
    const start = performance.now();

    try {
      const result = await next({
        context: {
          get wideEvent() {
            return event;
          },
        },
      });
      event.setDuration(performance.now() - start);
      logger?.info({ wide_event: event.toJSON() }, "request.completed");
      return result;
    } catch (error) {
      event.setDuration(performance.now() - start);
      // markFailed with ORPCError code or generic INTERNAL_SERVER_ERROR
      logger?.error({ wide_event: event.toJSON() }, "request.failed");
      throw error;
    }
  });
```

### Position in Middleware Chain

```
BaseContext
  → loggingMiddleware  (creates WideEvent, emits on completion)
  → dbProvider         (injects database)
  → serviceProvider    (injects services with wideEvent)
  → [authMiddleware]   (optional, for protected routes)
  → handler
```

---

## 3. Wide Event in Services

Services depend on `EventCollector<D, Extra>` — a narrow interface from `src/lib/wide-event.ts` — not the concrete `WideEvent` class. This decouples services from the collection/emission strategy.

### EventCollector Interface

```ts
type EventCollector<D extends string = string, Extra extends string = never> = {
  addDetail(key: EventKey<D, Extra>, value: unknown): void;
  markFailed(code: string, message: string): void;
};
```

A `noopCollector` is exported for tests or contexts where event collection is unnecessary. Service constructors accept `EventCollector` as optional and fall back to `noopCollector`:

```ts
constructor(db: AppDb, events?: EventCollector<"fungi">) {
  this.events = events ?? noopCollector;
}
```

### CRUD-Only Domain

```ts
export class FungiService {
  private readonly events: EventCollector<"fungi">;

  constructor(
    private readonly db: AppDb,
    events?: EventCollector<"fungi">,
  ) {
    this.events = events ?? noopCollector;
  }

  async create(input: FungusInsert) {
    const [row] = await this.db.insert(fungi).values(input).returning();
    this.events.addDetail("fungi.created", { id: row.id, commonName: row.commonName });
    //                      ^ autocompletes: "fungi.created" | "fungi.updated" | "fungi.deleted"
    return row;
  }
}
```

### Domain with Extra Events

```ts
export class FungiService {
  private readonly events: EventCollector<"fungi", "spore_analyzed" | "habitat_mapped">;

  constructor(
    private readonly db: AppDb,
    events?: EventCollector<"fungi", "spore_analyzed" | "habitat_mapped">,
  ) {
    this.events = events ?? noopCollector;
  }

  async analyzeSpore(id: number) {
    // ...
    this.events.addDetail("fungi.spore_analyzed", { id });
    //                      ^ also autocompletes: "fungi.spore_analyzed" | "fungi.habitat_mapped"
  }
}
```

### Naming Convention

Use `{domain}.{action}` dot-notation, similar to Stripe event types:

- `fungi.created` — a fungus was created
- `fungi.deleted` — a fungus was deleted
- `auth.session_resolved` — session was validated
- `order.payment_failed` — payment processing failed

### Wiring in Service Provider

The service provider passes `context.wideEvent` to service constructors:

```ts
export const serviceProvider = os
  .$context<BaseWideEvent>()
  .middleware(async ({ context, next }) => {
    let _fungiService: FungiService | undefined;

    return next({
      context: {
        db,
        get fungiService() {
          return (_fungiService ??= new FungiService(db, context.wideEvent));
        },
      },
    });
  });
```

---

## 4. Wide Event Output

### Successful Request

```json
{
  "level": 30,
  "module": "api-http",
  "wide_event": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-04-26T12:00:00.000Z",
    "duration_ms": 42,
    "outcome": "success",
    "details": {
      "fungi.created": { "id": 7, "commonName": "Chanterelle" }
    }
  },
  "msg": "request.completed"
}
```

### Failed Request

```json
{
  "level": 50,
  "module": "api-http",
  "wide_event": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-04-26T12:00:00.000Z",
    "duration_ms": 5,
    "outcome": "error",
    "error": { "code": "NOT_FOUND", "message": "Not Found" }
  },
  "msg": "request.failed"
}
```

---

## 5. Handler-Level Pino Logging

`LoggingHandlerPlugin` from `@orpc/experimental-pino` handles request lifecycle logging at the handler level (`src/routes/api.$.ts`). It auto-logs request start/end and injects the logger into oRPC context. The wide event middleware uses this logger to emit the summary event.

---

## 6. Testing

The `EventCollector` parameter is optional — services fall back to `noopCollector`, so they work without it in tests. To verify event enrichment, pass a real `WideEvent`:

```ts
import { WideEvent } from "#/lib/wide-event";

it("enriches wide event on create", async () => {
  const event = new WideEvent("test-request");
  const service = new FungiService(db, event);

  await service.create({ commonName: "Chanterelle", scientificName: "C. cibarius" });

  const output = event.toJSON();
  expect(output.details).toHaveProperty("fungi.created");
});
```

No mock logger needed for service tests.

---

## Quick Reference

| What                          | Where / How                                                   |
| ----------------------------- | ------------------------------------------------------------- |
| Root logger                   | `src/lib/logger.ts` — `logger`                                |
| Handler child logger          | `createLogger("module-name")`                                 |
| Wide event class              | `src/lib/wide-event.ts` — `WideEvent<D, Extra>`               |
| Wide event middleware         | `src/orpc/middleware/logging.ts` — `loggingMiddleware`        |
| CRUD-only service             | `WideEvent<"domain">` — autocompletes created/updated/deleted |
| Domain with extra events      | `WideEvent<"domain", "custom_action">` — adds custom keys     |
| Access wide event in services | `this.wideEvent?.addDetail("domain.action", data)`            |
| Mock wide event in tests      | `new WideEvent("test")` or omit (optional param)              |
