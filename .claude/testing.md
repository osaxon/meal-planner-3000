---
inclusion: manual
description: Unit testing guide for oRPC route handlers — mocking strategy, vi.hoisted/vi.mock patterns, call() usage, mock data shape requirements, and auth context helpers
---

# Testing oRPC Routes

Unit tests for oRPC route handlers using Vitest. Tests verify handler logic, error responses, and (when added) the auth middleware chain — by mocking all external dependencies.

## Core Principles

- Mock everything: services, database, logger. Route tests are not integration tests.
- Use `call()` from `@orpc/server` to invoke routes directly — no HTTP.
- Use `vi.hoisted()` for mock objects that must exist before module imports.
- Use `vi.mock()` to replace service classes.
- `vi.clearAllMocks()` in `beforeEach` for isolation.
- Mock return data must match the contract's Zod output schema exactly, or oRPC throws a validation error before your assertion runs.

## File Layout

```text
src/domains/{domain}/
├── __tests__/
│   ├── {domain}.service.test.ts
│   └── {domain}.router.test.ts
├── {domain}.zod.ts
├── {domain}.contract.ts
├── {domain}.service.ts
└── {domain}.router.ts
```

## Test Helpers — `src/orpc/router/__tests__/test-utils.ts`

Shared helpers for route tests. Keep these separate from service test utils.

```ts
import { vi } from "vitest";
import type pino from "pino";

/** Minimal context for public routes. */
export function publicContext() {
  return { context: {} };
}

/** Context with request headers (needed when RequestHeadersPlugin is used). */
export function requestContext() {
  return { context: { reqHeaders: new Headers() } };
}

/** Mock logger that satisfies pino.Logger. child() returns itself. */
export function createMockLogger() {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger as unknown as pino.Logger;
}
```

## Writing a Route Test

### Step 1: Hoisted Mocks

Define mock objects for every service your routes call. These are hoisted above imports.

```ts
const { fungiServiceMock } = vi.hoisted(() => ({
  fungiServiceMock: {
    list: vi.fn(),
    findById: vi.fn(),
    findByScientificName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
```

### Step 2: Mock Modules

Replace the service class so the service provider returns your mock. The path must match the import in `service-provider.ts`.

```ts
vi.mock("#/domains/fungi/fungi.service", () => ({
  FungiService: vi.fn().mockImplementation(() => fungiServiceMock),
}));
```

Mock the logger module so Pino doesn't try to create transports in tests:

```ts
vi.mock("#/lib/logger", () => ({
  logger: {},
  createLogger: vi.fn(() => createMockLogger()),
  createModuleLogger: vi.fn((_name, parent) => parent),
}));
```

### Step 3: Mock Data

Define data that matches the contract's output schema. If a field is missing or the wrong type, oRPC will reject the response with a validation error — not the assertion failure you expect.

```ts
const mockFungus = {
  id: 1,
  commonName: "Chanterelle",
  scientificName: "Cantharellus cibarius",
  habitat: "Forest floor",
  edible: true,
  description: "Golden trumpet-shaped mushroom",
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

### Step 4: Write Tests

```ts
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import router from "../root";
import { publicContext, createMockLogger } from "./test-utils";

// ... hoisted mocks and vi.mock() calls from above ...

describe("Fungi Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns all fungi", async () => {
      fungiServiceMock.list.mockResolvedValue([mockFungus]);

      const result = await call(router.fungi.list, {}, publicContext());

      expect(result).toEqual([mockFungus]);
      expect(fungiServiceMock.list).toHaveBeenCalledOnce();
    });

    it("returns empty array when no fungi exist", async () => {
      fungiServiceMock.list.mockResolvedValue([]);

      const result = await call(router.fungi.list, {}, publicContext());

      expect(result).toEqual([]);
    });
  });

  describe("find", () => {
    it("returns a fungus by id", async () => {
      fungiServiceMock.findById.mockResolvedValue(mockFungus);

      const result = await call(router.fungi.find, { id: 1 }, publicContext());

      expect(result).toEqual(mockFungus);
    });

    it("throws NOT_FOUND when fungus does not exist", async () => {
      fungiServiceMock.findById.mockResolvedValue(null);

      await expect(call(router.fungi.find, { id: 999 }, publicContext())).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("create", () => {
    const input = {
      commonName: "Chanterelle",
      scientificName: "Cantharellus cibarius",
      habitat: "Forest floor",
      edible: true,
    };

    it("creates a fungus", async () => {
      fungiServiceMock.findByScientificName.mockResolvedValue(null);
      fungiServiceMock.create.mockResolvedValue(mockFungus);

      const result = await call(router.fungi.create, input, publicContext());

      expect(result).toEqual(mockFungus);
      expect(fungiServiceMock.create).toHaveBeenCalledWith(input);
    });

    it("throws DUPLICATE when scientific name exists", async () => {
      fungiServiceMock.findByScientificName.mockResolvedValue(mockFungus);

      await expect(call(router.fungi.create, input, publicContext())).rejects.toMatchObject({
        code: "DUPLICATE",
      });

      expect(fungiServiceMock.create).not.toHaveBeenCalled();
    });
  });
});
```

## Output Schema Validation

oRPC validates handler return values against the contract's `.output()` schema. If your mock data doesn't match:

```ts
// BAD — missing required fields, oRPC throws validation error
fungiServiceMock.findById.mockResolvedValue({ id: 1, commonName: "Test" });

// GOOD — all fields present and correctly typed
fungiServiceMock.findById.mockResolvedValue(mockFungus);
```

The error will look like a Zod validation failure, not your expected `NOT_FOUND` or assertion. If you see unexpected validation errors in tests, check your mock data shape first.

## When You Add Auth

Once auth middleware is added to the chain, extend the test helpers:

```ts
// In test-utils.ts
import { auth } from "#/lib/auth";

export function authedContext() {
  return { context: { reqHeaders: new Headers() } };
}

export function givenAuthenticated() {
  vi.mocked(auth.api.getSession).mockResolvedValue({
    session: { id: "session-1", userId: "user-1" },
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
  });
}

export function givenAdmin() {
  givenAuthenticated();
  vi.mocked(auth.api.userHasPermission).mockResolvedValue({
    error: null,
    success: true,
  });
}
```

Then mock the auth module:

```ts
vi.mock("#/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      userHasPermission: vi.fn(),
    },
  },
}));
```

Auth rejection tests:

```ts
it("rejects without headers", async () => {
  await expect(call(router.items.list, {}, { context: {} })).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
});

it("rejects invalid session", async () => {
  vi.mocked(auth.api.getSession).mockResolvedValue(null);
  await expect(call(router.items.list, {}, authedContext())).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
});
```

## Common Pitfalls

- Every service class imported by `service-provider.ts` must be mocked, even if your test doesn't exercise it. Otherwise module resolution fails.
- Mock the logger module (`#/lib/logger`) to prevent Pino transport initialization in tests.
- `vi.clearAllMocks()` in `beforeEach` — without it, mock state leaks between tests.
- Mock data must match the Zod output schema exactly. Missing or wrong-typed fields cause validation errors, not assertion failures.
- Use `#/` path aliases in `vi.mock()` calls to match the actual import paths in source code.
