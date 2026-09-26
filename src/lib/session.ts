import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "../db";
import { profiles } from "../db/schema";
import { eq } from "drizzle-orm";

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
export async function getOwnProfile(userId: string) {
  return (
    await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1)
  )[0];
}
