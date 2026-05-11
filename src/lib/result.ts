// ── Result Type ─────────────────────────────────────────────────────────────

/** A successful outcome carrying a value. */
export type Ok<T> = { readonly ok: true; readonly value: T };

/** A failed outcome carrying an error. */
export type Err<E> = { readonly ok: false; readonly error: E };

/**
 * Discriminated union for explicit error handling.
 *
 * After checking `result.ok`, TypeScript narrows automatically:
 *
 *   if (result.ok) result.value   // T
 *   else           result.error   // E
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/** Create a success result. */
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

/** Create a failure result. */
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

// ── Domain Errors ───────────────────────────────────────────────────────────

/**
 * Lightweight domain error — just a code and a message.
 *
 * The `Code` generic narrows to a string literal so the router can
 * pass `error.code` straight to `ORPCError` without a mapping function.
 */
export type DomainError<Code extends string = string> = {
  readonly code: Code;
  readonly message: string;
};
