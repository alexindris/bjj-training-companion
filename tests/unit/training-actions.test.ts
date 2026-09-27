import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  getSession: vi.fn(),
  create: vi.fn(),
  select: vi.fn(),
  save: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSession: boundary.getSession }));
vi.mock("next/cache", () => ({ revalidatePath: boundary.revalidate }));
vi.mock("@/lib/training-store", () => ({
  createOwnedGoal: boundary.create,
  selectOwnedGoal: boundary.select,
  saveOwnedClass: boundary.save,
  TrainingNotFoundError: class extends Error {},
}));
import { createGoal, saveClass, selectFocus } from "@/app/training-actions";
import { TrainingNotFoundError } from "@/lib/training-store";

const classInput = {
  submissionId: "123e4567-e89b-42d3-a456-426614174000",
  date: "2026-09-27",
  mode: "gi",
  technique: "  Synthetic guard practice\n ",
  goalId: null,
  outcome: null,
  opportunities: null,
  attempts: null,
  successes: null,
  obstacle: "",
  nextCue: "",
};
const goalId = "123e4567-e89b-42d3-a456-426614174001";
const receipt = { classId: "saved-class", alreadySaved: false };

beforeEach(() => {
  vi.resetAllMocks();
  boundary.getSession.mockResolvedValue({ user: { id: "verified-owner" } });
  boundary.create.mockResolvedValue({ id: goalId });
  boundary.select.mockResolvedValue(true);
  boundary.save.mockResolvedValue(receipt);
});

const operations = [
  {
    action: createGoal,
    input: { title: "  Keep frames\n ", notes: " private " },
    store: boundary.create,
  },
  { action: selectFocus, input: goalId, store: boundary.select },
  { action: saveClass, input: classInput, store: boundary.save },
];

describe("verified training mutations", () => {
  it.each(operations)(
    "rejects absent authentication before private writes ($action)",
    async ({ action, input, store }) => {
      boundary.getSession.mockResolvedValue(null);
      expect(await action(input)).toEqual({ error: "unauthenticated" });
      expect(store).not.toHaveBeenCalled();
      expect(boundary.revalidate).not.toHaveBeenCalled();
    },
  );

  it.each(operations)(
    "sanitizes verification failure ($action)",
    async ({ action, input, store }) => {
      boundary.getSession.mockRejectedValue(
        new Error("secret session diagnostic"),
      );
      expect(await action(input)).toEqual({ error: "unavailable" });
      expect(store).not.toHaveBeenCalled();
      expect(boundary.revalidate).not.toHaveBeenCalled();
    },
  );

  it.each(operations)(
    "sanitizes persistence failure ($action)",
    async ({ action, input, store }) => {
      store.mockRejectedValue(new Error("private SQL data"));
      expect(await action(input)).toEqual({ error: "unavailable" });
      expect(boundary.revalidate).not.toHaveBeenCalled();
    },
  );

  it("creates an inactive goal for the session owner preserving text", async () => {
    const input = {
      title: "  Keep frames\n ",
      notes: " private ",
      userId: "foreign",
    };
    expect(await createGoal(input)).toEqual({ goalId });
    expect(boundary.create).toHaveBeenCalledExactlyOnceWith("verified-owner", {
      title: input.title,
      notes: input.notes,
    });
    expect(boundary.select).not.toHaveBeenCalled();
    expect(boundary.revalidate).toHaveBeenCalledExactlyOnceWith(
      "/[locale]",
      "layout",
    );
  });

  it("returns goal field errors without writing rejected input", async () => {
    const result = await createGoal({ title: "   ", notes: "" });
    expect(result.error).toBe("invalidInput");
    expect(result.fieldErrors?.title).toHaveLength(1);
    expect(boundary.create).not.toHaveBeenCalled();
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });

  it.each([goalId, null])(
    "selects or clears focus only for the session owner: %j",
    async (input) => {
      expect(await selectFocus(input)).toEqual({});
      expect(boundary.select).toHaveBeenCalledExactlyOnceWith(
        "verified-owner",
        input,
      );
      expect(boundary.revalidate).toHaveBeenCalledExactlyOnceWith(
        "/[locale]",
        "layout",
      );
    },
  );

  it.each([undefined, {}, "invalid"])(
    "rejects malformed focus: %j",
    async (input) => {
      expect(await selectFocus(input)).toEqual({ error: "invalidInput" });
      expect(boundary.select).not.toHaveBeenCalled();
    },
  );

  it("gives the same safe focus result for foreign or missing goals", async () => {
    boundary.select.mockResolvedValue(false);
    expect(await selectFocus(goalId)).toEqual({ error: "notFound" });
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "returns an honest class receipt, alreadySaved=%s",
    async (alreadySaved) => {
      boundary.save.mockResolvedValue({ ...receipt, alreadySaved });
      expect(await saveClass({ ...classInput, userId: "foreign" })).toEqual({
        ...receipt,
        alreadySaved,
      });
      expect(boundary.save).toHaveBeenCalledExactlyOnceWith(
        "verified-owner",
        classInput,
      );
      expect(boundary.revalidate).toHaveBeenCalledExactlyOnceWith(
        "/[locale]",
        "layout",
      );
    },
  );

  it("returns class field errors without writing rejected input", async () => {
    const result = await saveClass({
      ...classInput,
      date: "2026-02-30",
      technique: "",
    });
    expect(result.error).toBe("invalidInput");
    expect(result.fieldErrors?.date).toHaveLength(1);
    expect(result.fieldErrors?.technique).toHaveLength(1);
    expect(boundary.save).not.toHaveBeenCalled();
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });

  it("returns safe not-found for a forged class goal", async () => {
    boundary.save.mockRejectedValue(new TrainingNotFoundError());
    expect(
      await saveClass({ ...classInput, goalId, outcome: "no_opportunity" }),
    ).toEqual({ error: "notFound" });
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });
});
