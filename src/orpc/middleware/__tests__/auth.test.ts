import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ORPCError } from "@orpc/server";
import type { ContextWithServices } from "#/orpc";

// ── Mock ───────────────────────────────────────────────────────────────────

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock("#/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

// ── Import after mocks ─────────────────────────────────────────────────────

import { authMiddleware } from "../auth";

// ── Helpers ─────────────────────────────────────────────────────────────────

const fakeUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeSession = {
  id: "session-1",
  expiresAt: new Date(Date.now() + 86400000),
  token: "tok_abc",
  userId: "user-1",
  ipAddress: null,
  userAgent: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Executes the authMiddleware by calling it through a minimal oRPC-compatible
 * invocation. We build a simple handler that uses the middleware, then call it.
 */
async function callMiddleware(reqHeaders?: Headers) {
  const { os } = await import("@orpc/server");

  // Build a tiny procedure that uses the auth middleware and returns the context
  const procedure = os
    .$context<ContextWithServices>()
    .use(authMiddleware)
    .handler(({ context }) => context);

  // Use the oRPC `call` helper to invoke it
  const { call } = await import("@orpc/server");
  return call(procedure, undefined, {
    context: {
      reqHeaders: reqHeaders ?? new Headers(),
      db: {} as any,
      fungiService: {} as any,
    } as ContextWithServices,
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("injects session and user into context when session is valid", async () => {
    getSessionMock.mockResolvedValue({
      session: fakeSession,
      user: fakeUser,
    });

    const result = await callMiddleware(new Headers({ cookie: "session=tok_abc" }));

    expect(getSessionMock).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      session: fakeSession,
      user: fakeUser,
    });
  });

  it("throws UNAUTHORIZED when no session exists", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(callMiddleware()).rejects.toThrow(ORPCError);
    await expect(callMiddleware()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  });

  it("passes reqHeaders to auth.api.getSession", async () => {
    getSessionMock.mockResolvedValue({
      session: fakeSession,
      user: fakeUser,
    });

    const headers = new Headers({ cookie: "session=tok_abc" });
    await callMiddleware(headers);

    expect(getSessionMock).toHaveBeenCalledWith({ headers });
  });

  it("uses empty Headers when reqHeaders is undefined", async () => {
    getSessionMock.mockResolvedValue({
      session: fakeSession,
      user: fakeUser,
    });

    // Build a procedure and call with undefined reqHeaders
    const { os, call } = await import("@orpc/server");
    const procedure = os
      .$context<ContextWithServices>()
      .use(authMiddleware)
      .handler(({ context }) => context);

    await call(procedure, undefined, {
      context: {
        reqHeaders: undefined,
        db: {} as any,
        fungiService: {} as any,
      } as unknown as ContextWithServices,
    });

    const passedHeaders = getSessionMock.mock.calls[0][0].headers;
    expect(passedHeaders).toBeInstanceOf(Headers);
  });
});
