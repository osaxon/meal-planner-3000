import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { config } from "dotenv";
import * as schema from "./schema";

config({ path: ".env.local" });

export const createDatabase = () =>
  drizzle(
    createClient({
      url: process.env.TURSO_CONNECTION_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    }),
    { schema },
  );

export type AppDb = ReturnType<typeof createDatabase>;
