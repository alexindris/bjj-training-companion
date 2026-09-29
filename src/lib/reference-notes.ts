import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { referenceNotes } from "@/db/schema";
import type { ReferenceTarget } from "./reference-validation";
import { referenceExists } from "./reference-store";

export class ReferenceNotFoundError extends Error {}

function targetColumn(target: ReferenceTarget) {
  return target.kind === "position"
    ? referenceNotes.positionId
    : referenceNotes.techniqueId;
}

export async function readOwnNote(userId: string, target: ReferenceTarget) {
  const [row] = await db
    .select({ body: referenceNotes.body, updatedAt: referenceNotes.updatedAt })
    .from(referenceNotes)
    .where(
      and(
        eq(referenceNotes.userId, userId),
        eq(targetColumn(target), target.referenceId),
      ),
    )
    .limit(1);
  return row
    ? { body: row.body, updatedAt: row.updatedAt.toISOString() }
    : null;
}

export async function saveOwnNote(
  userId: string,
  input: ReferenceTarget & { body: string },
) {
  if (!(await referenceExists(input))) throw new ReferenceNotFoundError();
  const now = new Date();
  const [saved] = await db
    .insert(referenceNotes)
    .values({
      id: randomUUID(),
      userId,
      positionId: input.kind === "position" ? input.referenceId : null,
      techniqueId: input.kind === "technique" ? input.referenceId : null,
      body: input.body,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [referenceNotes.userId, targetColumn(input)],
      set: { body: input.body, updatedAt: now },
    })
    .returning();
  if (!saved) throw new Error("Reference note save failed");
}

export async function deleteOwnNote(userId: string, target: ReferenceTarget) {
  if (!(await referenceExists(target))) throw new ReferenceNotFoundError();
  await db
    .delete(referenceNotes)
    .where(
      and(
        eq(referenceNotes.userId, userId),
        eq(targetColumn(target), target.referenceId),
      ),
    );
}
