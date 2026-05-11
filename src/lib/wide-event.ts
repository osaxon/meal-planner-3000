// ── Event Key Types ─────────────────────────────────────────────────────────

/** Common CRUD actions every domain gets for free. */
type CrudAction = "created" | "updated" | "deleted";

/**
 * Dot-notation event key scoped to a domain.
 *
 * Base type provides CRUD actions. Services can extend with domain-specific
 * events by passing a union as `Extra`:
 *
 *   EventKey<"fungi">                          → "fungi.created" | "fungi.updated" | "fungi.deleted"
 *   EventKey<"fungi", "spore_analyzed">        → above + "fungi.spore_analyzed"
 */
export type EventKey<D extends string = string, Extra extends string = never> =
  | `${D}.${CrudAction}`
  | `${D}.${Extra}`;

// ── EventCollector Interface ────────────────────────────────────────────────

/**
 * Minimal interface that services depend on for observability.
 *
 * Services accept `EventCollector<"fungi">` instead of the concrete `WideEvent`.
 * This keeps services decoupled from the collection/emission strategy.
 */
export type EventCollector<D extends string = string, Extra extends string = never> = {
  /** Append a structured detail using dot-notation keys (e.g. "fungi.created"). */
  addDetail(key: EventKey<D, Extra>, value: unknown): void;
  /** Mark the event as failed with error info. */
  markFailed(code: string, message: string): void;
};

/** A no-op collector for tests or contexts where event collection is unnecessary. */
export const noopCollector: EventCollector = {
  addDetail() {},
  markFailed() {},
};

// ── WideEvent Class ─────────────────────────────────────────────────────────

/**
 * A Stripe-style wide event that accumulates structured data throughout
 * a request lifecycle and is emitted once at the end.
 *
 * Implements `EventCollector` — the narrow interface services depend on.
 * The middleware creates `WideEvent` (accepts any domain).
 * Services narrow via `EventCollector<"fungi">` for CRUD autocomplete,
 * or `EventCollector<"fungi", "spore_analyzed">` to add domain-specific keys.
 */
export class WideEvent<
  D extends string = string,
  Extra extends string = never,
> implements EventCollector<D, Extra> {
  private readonly data: Record<string, unknown> = {};
  private readonly details: Array<{ key: string; value: unknown }> = [];
  private outcome: "success" | "error" = "success";
  private errorInfo: { code: string; message: string } | undefined;

  constructor(requestId: string) {
    this.data.request_id = requestId;
    this.data.timestamp = new Date().toISOString();
  }

  /** Set a top-level property on the event. */
  set(key: string, value: unknown): void {
    this.data[key] = value;
  }

  /** Append a structured detail using dot-notation keys (e.g. "fungi.created"). */
  addDetail(key: EventKey<D, Extra>, value: unknown): void {
    this.details.push({ key, value });
  }

  /** Mark the event as failed with error info. */
  markFailed(code: string, message: string): void {
    this.outcome = "error";
    this.errorInfo = { code, message };
  }

  /** Add timing information. Called by the middleware at the end of the request. */
  setDuration(ms: number): void {
    this.data.duration_ms = Math.round(ms);
  }

  /** Serialize the event into a plain object for logging. */
  toJSON(): Record<string, unknown> {
    const event: Record<string, unknown> = {
      ...this.data,
      outcome: this.outcome,
    };

    if (this.details.length > 0) {
      event.details = Object.fromEntries(this.details.map((d) => [d.key, d.value]));
    }

    if (this.errorInfo) {
      event.error = this.errorInfo;
    }

    return event;
  }
}
