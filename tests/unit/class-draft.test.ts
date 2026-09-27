import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changeDraftGoal,
  changeDraftOutcome,
  createFreshDraft,
  deviceLocalDate,
  draftStorageKey,
  persistDraft,
  recoverDraft,
  removeDraft,
  settleDraftSave,
  toSaveInput,
  type ClassDraft,
  type DraftStorage,
} from "@/lib/class-draft";
import { classSchema } from "@/lib/training-validation";

const firstGoal = "20000000-0000-4000-8000-000000000002";
const otherGoal = "20000000-0000-4000-8000-000000000003";
const draft: ClassDraft = {
  submissionId: "20000000-0000-4000-8000-000000000001",
  date: "2026-09-27",
  mode: "no-gi",
  technique: "  Técnica / Session focus\n",
  goalId: firstGoal,
  outcome: "tried",
  opportunities: "",
  attempts: "0",
  successes: "",
  obstacle: "  Lo intenté  ",
  nextCue: "\nNext cue\n",
};

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: DraftStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
  return { storage, values };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("fresh account-local draft defaults", () => {
  it("formats device-local date near a UTC boundary rather than converting to UTC", () => {
    const date = new Date("2026-09-27T00:15:00+14:00");
    vi.spyOn(date, "getFullYear").mockReturnValue(2026);
    vi.spyOn(date, "getMonth").mockReturnValue(8);
    vi.spyOn(date, "getDate").mockReturnValue(27);
    expect(date.toISOString().slice(0, 10)).toBe("2026-09-26");
    expect(deviceLocalDate(date)).toBe("2026-09-27");
    expect(deviceLocalDate(new Date(2026, 0, 2))).toBe("2026-01-02");
    expect(deviceLocalDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("uses current device date, saved mode and active goal with a fresh UUID", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 27, 10));
    const fresh = createFreshDraft("gi", firstGoal);
    expect(fresh).toEqual({
      submissionId: expect.any(String),
      date: "2026-09-27",
      mode: "gi",
      technique: "",
      goalId: firstGoal,
      outcome: "",
      opportunities: "",
      attempts: "",
      successes: "",
      obstacle: "",
      nextCue: "",
    });
    expect(fresh.submissionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(createFreshDraft("gi", firstGoal).submissionId).not.toBe(
      fresh.submissionId,
    );
  });

  it("starts without a selected goal when there is no current focus", () => {
    const fresh = createFreshDraft("no-gi", null, new Date(2026, 0, 2));
    expect(fresh.date).toBe("2026-01-02");
    expect(fresh.mode).toBe("no-gi");
    expect(fresh.goalId).toBe("");
  });
});

describe("one draft per account and recovery before writes", () => {
  it("namespaces keys by verified account independent of locale", () => {
    expect(draftStorageKey("account-a")).toBe("bjj:class-draft:v1:account-a");
    expect(draftStorageKey("account-b")).toBe("bjj:class-draft:v1:account-b");
  });

  it("returns an absent draft without creating or deleting anything", () => {
    const { storage, values } = memoryStorage();
    expect(recoverDraft(storage, "a")).toEqual({ draft: null, error: null });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(values.size).toBe(0);
  });

  it("recovers every field verbatim before persisting and leaves another account hidden", () => {
    const { storage, values } = memoryStorage({
      [draftStorageKey("a")]: JSON.stringify({ version: 1, draft }),
    });
    expect(recoverDraft(storage, "a")).toEqual({ draft, error: null });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(recoverDraft(storage, "b")).toEqual({ draft: null, error: null });
    expect(persistDraft(storage, "b", { ...draft, goalId: otherGoal })).toBe(
      true,
    );
    expect(JSON.parse(values.get(draftStorageKey("b"))!)).toEqual({
      version: 1,
      draft: { ...draft, goalId: otherGoal },
    });
    expect(recoverDraft(storage, "a").draft).toEqual(draft);
  });

  it("recovers incomplete required fields and partially typed invalid counts without submitting", () => {
    const unfinished = {
      ...draft,
      date: "",
      technique: "",
      outcome: "" as const,
      opportunities: "-",
      attempts: "1.",
      successes: "not yet",
    };
    const { storage } = memoryStorage();
    expect(persistDraft(storage, "a", unfinished)).toBe(true);
    expect(recoverDraft(storage, "a")).toEqual({
      draft: unfinished,
      error: null,
    });
    expect(classSchema.safeParse(toSaveInput(unfinished)).success).toBe(false);
  });

  it("recovers a deliberate no-goal draft and all supported outcomes", () => {
    const { storage } = memoryStorage();
    for (const outcome of [
      "",
      "no_opportunity",
      "tried",
      "worked_on_something_else",
    ] as const) {
      const input = { ...draft, goalId: "", outcome };
      expect(persistDraft(storage, "a", input)).toBe(true);
      expect(recoverDraft(storage, "a")).toEqual({ draft: input, error: null });
    }
  });

  it.each([
    "",
    "{",
    "null",
    "[]",
    "{}",
    JSON.stringify({ version: 2, draft }),
    JSON.stringify({ version: "1", draft }),
    JSON.stringify({ draft }),
    JSON.stringify({ version: 1, draft: null }),
  ])("rejects invalid JSON/format %s without replacing stored input", (raw) => {
    const { storage, values } = memoryStorage({ [draftStorageKey("a")]: raw });
    expect(recoverDraft(storage, "a")).toEqual({
      draft: null,
      error: "invalid",
    });
    expect(values.get(draftStorageKey("a"))).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    ["submissionId", "not-a-uuid"],
    ["goalId", "foreign"],
    ["mode", "nogi"],
    ["outcome", "won"],
    ["date", null],
    ["technique", 1],
    ["opportunities", 0],
    ["attempts", null],
    ["successes", []],
    ["obstacle", {}],
    ["nextCue", false],
  ])("rejects structurally invalid stored %s", (field, value) => {
    const { storage } = memoryStorage({
      [draftStorageKey("a")]: JSON.stringify({
        version: 1,
        draft: { ...draft, [field]: value },
      }),
    });
    expect(recoverDraft(storage, "a")).toEqual({
      draft: null,
      error: "invalid",
    });
  });

  it("reports unavailable storage separately and keeps current input", () => {
    const unavailable = {
      getItem: () => {
        throw new Error("Unavailable");
      },
      setItem: () => {
        throw new Error("Unavailable");
      },
      removeItem: () => {
        throw new Error("Unavailable");
      },
    };
    expect(recoverDraft(unavailable, "a")).toEqual({
      draft: null,
      error: "unavailable",
    });
    expect(persistDraft(unavailable, "a", draft)).toBe(false);
    expect(removeDraft(unavailable, "a")).toBe(false);
    expect(draft.technique).toBe("  Técnica / Session focus\n");
    expect(draft.submissionId).toBe("20000000-0000-4000-8000-000000000001");
  });

  it("discard removes only the current account unfinished draft", () => {
    const { storage, values } = memoryStorage({
      [draftStorageKey("a")]: "unfinished-a",
      [draftStorageKey("b")]: "unfinished-b",
      unrelated: "keep",
    });
    expect(removeDraft(storage, "a")).toBe(true);
    expect(values.has(draftStorageKey("a"))).toBe(false);
    expect(values.get(draftStorageKey("b"))).toBe("unfinished-b");
    expect(values.get("unrelated")).toBe("keep");
    expect(removeDraft(storage, "a")).toBe(true);
  });
});

describe("selective goal and outcome changes", () => {
  it.each([otherGoal, ""])(
    "clears the reflection on goal selection %j while retaining class fields and token",
    (goalId) => {
      const changed = changeDraftGoal(draft, goalId);
      expect(changed).toEqual({
        ...draft,
        goalId,
        outcome: "",
        opportunities: "",
        attempts: "",
        successes: "",
        obstacle: "",
        nextCue: "",
      });
      expect(draft.goalId).toBe(firstGoal);
      expect(draft.obstacle).toBe("  Lo intenté  ");
    },
  );

  it("does not lose the reflection if the goal remains selected", () => {
    expect(changeDraftGoal(draft, firstGoal)).toEqual(draft);
  });

  it.each(["", "no_opportunity", "worked_on_something_else"] as const)(
    "clears all counts when switching outcome to %j and retains reflections",
    (outcome) => {
      const original = {
        ...draft,
        opportunities: "3",
        attempts: "2",
        successes: "1",
      };
      expect(changeDraftOutcome(original, outcome)).toEqual({
        ...original,
        outcome,
        opportunities: "",
        attempts: "",
        successes: "",
      });
      expect(original.successes).toBe("1");
    },
  );

  it("keeps known/unknown count strings for Tried it", () => {
    expect(changeDraftOutcome(draft, "tried")).toEqual(draft);
    expect(
      changeDraftOutcome({ ...draft, outcome: "no_opportunity" }, "tried"),
    ).toEqual(draft);
  });
});

describe("submission conversion preserves retries", () => {
  it("converts only the no-goal/no-outcome sentinels and preserves typed counts/text/token", () => {
    expect(toSaveInput(draft)).toEqual(draft);
    const general = {
      ...draft,
      goalId: "",
      outcome: "" as const,
      obstacle: "",
      nextCue: "",
      attempts: "",
    };
    const submitted = toSaveInput(general);
    expect(submitted).toEqual({ ...general, goalId: null, outcome: null });
    expect(classSchema.parse(submitted)).toEqual({
      ...submitted,
      opportunities: null,
      attempts: null,
      successes: null,
    });
    expect(general.goalId).toBe("");
    expect(general.outcome).toBe("");
  });

  it("keeps blank count unknown and explicit zero known through a save attempt", () => {
    const submitted = classSchema.parse(toSaveInput(draft));
    expect(submitted.opportunities).toBeNull();
    expect(submitted.attempts).toBe(0);
    expect(submitted.successes).toBeNull();
    expect(submitted.submissionId).toBe(draft.submissionId);
    expect(submitted.technique).toBe(draft.technique);
  });
});

describe("confirmed save and ordinary retry policy", () => {
  it.each([null, { alreadySaved: true }])(
    "retains current edited draft, token and stored input for receipt %j",
    (receipt) => {
      const edited = { ...draft, technique: "Edited retry text" };
      const { storage, values } = memoryStorage({
        [draftStorageKey("a")]: JSON.stringify({ version: 1, draft: edited }),
      });
      expect(settleDraftSave(storage, "a", edited, receipt)).toEqual({
        draft: edited,
        storageAvailable: true,
      });
      expect(recoverDraft(storage, "a").draft).toEqual(edited);
      expect(values.size).toBe(1);
      expect(storage.removeItem).not.toHaveBeenCalled();
      expect(storage.setItem).not.toHaveBeenCalled();
    },
  );

  it("clears only a confirmed new save and leaves other account drafts", () => {
    const { storage, values } = memoryStorage({
      [draftStorageKey("a")]: "unfinished",
      [draftStorageKey("b")]: "other account",
    });
    expect(
      settleDraftSave(storage, "a", draft, { alreadySaved: false }),
    ).toEqual({ draft: null, storageAvailable: true });
    expect(values.has(draftStorageKey("a"))).toBe(false);
    expect(values.get(draftStorageKey("b"))).toBe("other account");
  });

  it("still confirms a new save but warns if storage cannot be cleared", () => {
    const { storage } = memoryStorage();
    vi.mocked(storage.removeItem).mockImplementation(() => {
      throw new Error("Unavailable");
    });
    expect(
      settleDraftSave(storage, "a", draft, { alreadySaved: false }),
    ).toEqual({ draft: null, storageAvailable: false });
  });
});
