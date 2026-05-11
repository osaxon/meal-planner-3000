import { eq } from "drizzle-orm";
import { fungi } from "#/db/schema";
import { noopCollector } from "#/lib/wide-event";
import { ok, err } from "#/lib/result";
import type { AppDb } from "#/db/factory";
import type { EventCollector } from "#/lib/wide-event";
import type { Result, DomainError } from "#/lib/result";
import type { FungusInsert, FungusUpdate, Fungus } from "./fungi.zod";

// ── Domain Error Codes ──────────────────────────────────────────────────────

type NotFound = DomainError<"NOT_FOUND">;
type Duplicate = DomainError<"DUPLICATE">;

// ── Service ─────────────────────────────────────────────────────────────────

type Name = "fungi";
type Events = "spores_dispersed" | "spored_released";

export class FungiService {
  private readonly events: EventCollector<Name, Events>;

  constructor(
    private readonly db: AppDb,
    events?: EventCollector<Name, Events>,
  ) {
    this.events = events ?? noopCollector;
  }

  async list() {
    return this.db.select().from(fungi);
  }

  async findById(id: number) {
    const [row] = await this.db.select().from(fungi).where(eq(fungi.id, id));
    return row ?? null;
  }

  async findByScientificName(name: string) {
    const [row] = await this.db.select().from(fungi).where(eq(fungi.scientificName, name));
    return row ?? null;
  }

  async create(input: FungusInsert): Promise<Result<Fungus, Duplicate>> {
    const existing = await this.findByScientificName(input.scientificName);
    if (existing) {
      return err({
        code: "DUPLICATE",
        message: `Scientific name "${input.scientificName}" already exists`,
      });
    }

    const [row] = await this.db.insert(fungi).values(input).returning();
    this.events.addDetail("fungi.created", { id: row.id, commonName: row.commonName });
    return ok(row!);
  }

  async update(id: number, input: FungusUpdate): Promise<Result<Fungus, NotFound>> {
    const [row] = await this.db
      .update(fungi)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(fungi.id, id))
      .returning();
    if (!row) return err({ code: "NOT_FOUND", message: `Fungus ${id} not found` });
    this.events.addDetail("fungi.updated", { id });
    return ok(row);
  }

  async delete(id: number): Promise<Result<true, NotFound>> {
    const result = await this.db.delete(fungi).where(eq(fungi.id, id)).returning();
    if (result.length === 0) return err({ code: "NOT_FOUND", message: `Fungus ${id} not found` });
    this.events.addDetail("fungi.deleted", { id });
    return ok(true);
  }
}
