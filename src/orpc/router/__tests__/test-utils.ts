import { vi } from "vite-plus/test";
import type pino from "pino";
import { auth } from "#/lib/auth";

/** Minimal context for public routes. */
export function publicContext() {
  return { context: {} };
}

/** Context with request headers (needed by the auth middleware / RequestHeadersPlugin). */
export function requestContext() {
  return { context: { reqHeaders: new Headers() } };
}

/** Context for authenticated routes. Pair with givenAuthenticated(). */
export function authedContext() {
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

/** Make auth.api.getSession resolve to a valid session for an authenticated user. */
export function givenAuthenticated() {
  vi.mocked(auth.api.getSession).mockResolvedValue({
    session: { id: "session-1", userId: "user-1" },
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
  } as never);
}

/** Make auth.api.getSession resolve to null (no session). */
export function givenUnauthenticated() {
  vi.mocked(auth.api.getSession).mockResolvedValue(null as never);
}
