import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { db } from "../db";
import * as schema from "../db/schema";
import { readEnv } from "./env";

const env = readEnv();
export const auth = betterAuth({
  appName: "BJJ Training Companion",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [new URL(env.BETTER_AUTH_URL).origin],
  database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
  emailAndPassword: { enabled: true, minPasswordLength: 12, autoSignIn: false },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: {
    enabled: true,
    customRules: { "/sign-in/email": { window: 60, max: 10 } },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (newUser) => {
          await db
            .insert(schema.profiles)
            .values({ userId: newUser.id })
            .onConflictDoNothing();
        },
      },
    },
  },
  plugins: [nextCookies()],
});
