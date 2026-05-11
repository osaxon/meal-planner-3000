import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "#/db";

// Validate BETTER_AUTH_SECRET at module load time
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required");
}
if (secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [tanstackStartCookies()],
  secret,
  baseURL: process.env.BETTER_AUTH_URL,
});

// Inferred types from Better Auth configuration
export type Session = typeof auth.$Infer.Session;
export type AuthUser = Session["user"];
export type AuthSession = Session["session"];
