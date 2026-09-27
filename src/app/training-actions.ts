"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  classSchema,
  focusSchema,
  goalSchema,
} from "@/lib/training-validation";
import {
  createOwnedGoal,
  saveOwnedClass,
  selectOwnedGoal,
  TrainingNotFoundError,
} from "@/lib/training-store";

export type TrainingResult = {
  error?: "invalidInput" | "unauthenticated" | "notFound" | "unavailable";
  fieldErrors?: Record<string, string[]>;
  goalId?: string;
  classId?: string;
  alreadySaved?: boolean;
};

function refreshTraining() {
  revalidatePath("/[locale]", "layout");
}

export async function createGoal(input: unknown): Promise<TrainingResult> {
  try {
    const session = await getSession();
    if (!session) return { error: "unauthenticated" };
    const parsed = goalSchema.safeParse(input);
    if (!parsed.success)
      return {
        error: "invalidInput",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    const goal = await createOwnedGoal(session.user.id, parsed.data);
    refreshTraining();
    return { goalId: goal.id };
  } catch {
    return { error: "unavailable" };
  }
}

export async function selectFocus(input: unknown): Promise<TrainingResult> {
  try {
    const session = await getSession();
    if (!session) return { error: "unauthenticated" };
    const parsed = focusSchema.safeParse(input);
    if (!parsed.success) return { error: "invalidInput" };
    const selected = await selectOwnedGoal(session.user.id, parsed.data);
    if (!selected) return { error: "notFound" };
    refreshTraining();
    return {};
  } catch {
    return { error: "unavailable" };
  }
}

export async function saveClass(input: unknown): Promise<TrainingResult> {
  try {
    const session = await getSession();
    if (!session) return { error: "unauthenticated" };
    const parsed = classSchema.safeParse(input);
    if (!parsed.success)
      return {
        error: "invalidInput",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      };
    const receipt = await saveOwnedClass(session.user.id, parsed.data);
    refreshTraining();
    return receipt;
  } catch (error) {
    if (error instanceof TrainingNotFoundError) return { error: "notFound" };
    return { error: "unavailable" };
  }
}
