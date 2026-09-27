import { z } from "zod";
import {
  focusSchema,
  goalOutcomeSchema,
  recordIdSchema,
  trainingModeSchema,
  type GoalOutcome,
  type TrainingMode,
} from "@/lib/training-validation";

const draftFieldsSchema = z.object({
  submissionId: recordIdSchema,
  date: z.string(),
  mode: trainingModeSchema,
  technique: z.string(),
  goalId: z.union([focusSchema.unwrap(), z.literal("")]),
  outcome: z.union([goalOutcomeSchema, z.literal("")]),
  opportunities: z.string(),
  attempts: z.string(),
  successes: z.string(),
  obstacle: z.string(),
  nextCue: z.string(),
});
const storedDraftSchema = z.object({
  version: z.literal(1),
  draft: draftFieldsSchema,
});
export type ClassDraft = z.infer<typeof draftFieldsSchema>;
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type DraftRecovery = {
  draft: ClassDraft | null;
  error: "invalid" | "unavailable" | null;
};

export function draftStorageKey(userId: string) {
  return `bjj:class-draft:v1:${userId}`;
}

export function deviceLocalDate(date: Date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function createFreshDraft(
  mode: TrainingMode,
  activeGoalId: string | null,
  date = new Date(),
): ClassDraft {
  return {
    submissionId: crypto.randomUUID(),
    date: deviceLocalDate(date),
    mode,
    technique: "",
    goalId: activeGoalId ?? "",
    outcome: "",
    opportunities: "",
    attempts: "",
    successes: "",
    obstacle: "",
    nextCue: "",
  };
}

export function recoverDraft(
  storage: DraftStorage,
  userId: string,
): DraftRecovery {
  let raw: string | null;
  try {
    raw = storage.getItem(draftStorageKey(userId));
  } catch {
    return { draft: null, error: "unavailable" };
  }
  if (raw === null) return { draft: null, error: null };
  try {
    const result = storedDraftSchema.safeParse(JSON.parse(raw));
    if (!result.success) return { draft: null, error: "invalid" };
    return { draft: result.data.draft, error: null };
  } catch {
    return { draft: null, error: "invalid" };
  }
}

export function persistDraft(
  storage: DraftStorage,
  userId: string,
  draft: ClassDraft,
) {
  try {
    storage.setItem(
      draftStorageKey(userId),
      JSON.stringify({ version: 1, draft }),
    );
    return true;
  } catch {
    return false;
  }
}

export function removeDraft(storage: DraftStorage, userId: string) {
  try {
    storage.removeItem(draftStorageKey(userId));
    return true;
  } catch {
    return false;
  }
}

export function changeDraftGoal(draft: ClassDraft, goalId: string): ClassDraft {
  if (draft.goalId === goalId) return draft;
  return {
    ...draft,
    goalId,
    outcome: "",
    opportunities: "",
    attempts: "",
    successes: "",
    obstacle: "",
    nextCue: "",
  };
}

export function changeDraftOutcome(
  draft: ClassDraft,
  outcome: GoalOutcome | "",
): ClassDraft {
  if (outcome === "tried") return { ...draft, outcome };
  return { ...draft, outcome, opportunities: "", attempts: "", successes: "" };
}

export function toSaveInput(draft: ClassDraft) {
  return {
    ...draft,
    goalId: draft.goalId || null,
    outcome: draft.outcome || null,
  };
}

export function settleDraftSave(
  storage: DraftStorage,
  userId: string,
  draft: ClassDraft,
  receipt: { alreadySaved: boolean } | null,
) {
  if (receipt === null || receipt.alreadySaved) {
    return { draft, storageAvailable: true };
  }
  return { draft: null, storageAvailable: removeDraft(storage, userId) };
}
