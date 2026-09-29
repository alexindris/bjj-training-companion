"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  deleteOwnNote,
  ReferenceNotFoundError,
  saveOwnNote,
} from "@/lib/reference-notes";
import {
  deleteReferenceNoteSchema,
  saveReferenceNoteSchema,
} from "@/lib/reference-validation";

export type ReferenceActionResult = {
  saved?: true;
  deleted?: true;
  error?: "invalidInput" | "unauthenticated" | "notFound" | "unavailable";
  fieldErrors?: Record<string, string[]>;
};

function refreshReferenceDetail() {
  revalidatePath("/[locale]/library/[kind]/[id]", "page");
}

export async function saveReferenceNote(
  input: unknown,
): Promise<ReferenceActionResult> {
  try {
    const session = await getSession();
    if (!session) return { error: "unauthenticated" };
    const parsed = saveReferenceNoteSchema.safeParse(input);
    if (!parsed.success)
      return {
        error: "invalidInput",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    await saveOwnNote(session.user.id, parsed.data);
    refreshReferenceDetail();
    return { saved: true };
  } catch (error) {
    if (error instanceof ReferenceNotFoundError) return { error: "notFound" };
    return { error: "unavailable" };
  }
}

export async function deleteReferenceNote(
  input: unknown,
): Promise<ReferenceActionResult> {
  try {
    const session = await getSession();
    if (!session) return { error: "unauthenticated" };
    const parsed = deleteReferenceNoteSchema.safeParse(input);
    if (!parsed.success)
      return {
        error: "invalidInput",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    await deleteOwnNote(session.user.id, parsed.data);
    refreshReferenceDetail();
    return { deleted: true };
  } catch (error) {
    if (error instanceof ReferenceNotFoundError) return { error: "notFound" };
    return { error: "unavailable" };
  }
}
