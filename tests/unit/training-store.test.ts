import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  goals,
  goalObservations,
  profiles,
  trainingSessions,
} from "@/db/schema";
import type { ClassInput } from "@/lib/training-validation";

const boundary = vi.hoisted(() => {
  const names = [
    "select",
    "from",
    "where",
    "orderBy",
    "limit",
    "offset",
    "innerJoin",
    "leftJoin",
    "insert",
    "values",
    "returning",
    "onConflictDoNothing",
    "update",
    "set",
    "transaction",
  ] as const;
  return Object.fromEntries(names.map((name) => [name, vi.fn()])) as Record<
    (typeof names)[number],
    ReturnType<typeof vi.fn>
  >;
});
vi.mock("server-only", () => ({}));
vi.mock("node:crypto", () => ({ randomUUID: () => "new-record" }));
vi.mock("@/db", () => ({ db: boundary }));

import {
  createOwnedGoal,
  getActiveGoal,
  getOwnedClass,
  listGoals,
  listOwnedHistory,
  saveOwnedClass,
  selectOwnedGoal,
  TrainingNotFoundError,
} from "@/lib/training-store";

const input: ClassInput = {
  submissionId: "22f6f626-070c-47a3-9d73-af657a4af3e2",
  date: "2026-09-27",
  mode: "gi",
  technique: "  Technique / técnica  ",
  goalId: null,
  outcome: null,
  opportunities: null,
  attempts: null,
  successes: null,
  obstacle: "",
  nextCue: "",
};
const query = (predicate: unknown) => {
  const { sql, params } = new PgDialect().sqlToQuery(
    predicate as Parameters<PgDialect["sqlToQuery"]>[0],
  );
  return { sql, params };
};
const filter = (call = 0) => query(boundary.where.mock.calls[call][0]);

beforeEach(() => {
  vi.resetAllMocks();
  for (const [name, mock] of Object.entries(boundary)) {
    if (!["transaction", "limit", "offset", "returning"].includes(name))
      mock.mockReturnValue(boundary);
  }
  boundary.limit.mockResolvedValue([]);
  boundary.offset.mockResolvedValue([]);
  boundary.returning.mockResolvedValue([]);
  boundary.transaction.mockImplementation(async (operation) =>
    operation(boundary),
  );
});

describe("owned goals and active focus", () => {
  it("lists only the owner's goals with stable newest-first ordering", async () => {
    const records = [{ id: "own-goal", title: "Original title" }];
    boundary.orderBy.mockResolvedValue(records);
    expect(await listGoals("verified-owner")).toBe(records);
    expect(boundary.from).toHaveBeenCalledWith(goals);
    expect(filter()).toEqual({
      sql: '"goals"."user_id" = $1',
      params: ["verified-owner"],
    });
    expect(boundary.orderBy.mock.calls[0].map(query)).toEqual([
      { sql: '"goals"."created_at" desc', params: [] },
      { sql: '"goals"."id" desc', params: [] },
    ]);
  });
  it("reads the owned active pointer and returns no focus when absent", async () => {
    const goal = { id: "own-goal", userId: "verified-owner" };
    boundary.limit.mockResolvedValueOnce([{ goal }]);
    expect(await getActiveGoal("verified-owner")).toBe(goal);
    expect(filter()).toEqual({
      sql: '"profiles"."user_id" = $1',
      params: ["verified-owner"],
    });
    expect(query(boundary.innerJoin.mock.calls[0][1])).toEqual({
      sql: '("goals"."id" = "profiles"."active_goal_id" and "goals"."user_id" = "profiles"."user_id")',
      params: [],
    });
    expect(boundary.limit).toHaveBeenCalledWith(1);
    expect(await getActiveGoal("verified-owner")).toBeNull();
  });
  it("creates an inactive goal with verbatim text under the verified owner", async () => {
    const goal = {
      id: "new-record",
      title: "  Escape  ",
      notes: "  Notes / notas  ",
    };
    boundary.returning.mockResolvedValue([goal]);
    expect(await createOwnedGoal("verified-owner", goal)).toBe(goal);
    expect(boundary.insert).toHaveBeenCalledWith(goals);
    expect(boundary.values).toHaveBeenCalledWith({
      ...goal,
      userId: "verified-owner",
    });
    expect(boundary.update).not.toHaveBeenCalled();
    boundary.returning.mockResolvedValue([]);
    await expect(createOwnedGoal("verified-owner", goal)).rejects.toThrow(
      "Goal creation failed",
    );
  });
  it("selects an owned goal and updates only its owner's profile", async () => {
    boundary.limit.mockResolvedValue([{ id: "owned" }]);
    boundary.returning.mockResolvedValue([{ userId: "verified-owner" }]);
    expect(await selectOwnedGoal("verified-owner", "owned")).toBe(true);
    expect(filter(0)).toEqual({
      sql: '("goals"."user_id" = $1 and "goals"."id" = $2)',
      params: ["verified-owner", "owned"],
    });
    expect(filter(1)).toEqual({
      sql: '"profiles"."user_id" = $1',
      params: ["verified-owner"],
    });
    expect(boundary.update).toHaveBeenCalledWith(profiles);
    expect(boundary.set).toHaveBeenCalledWith({ activeGoalId: "owned" });
    expect(boundary.returning).toHaveBeenCalledExactlyOnceWith({
      userId: profiles.userId,
    });
  });
  it("denies missing/foreign goals without changing focus", async () => {
    expect(await selectOwnedGoal("verified-owner", "foreign")).toBe(false);
    expect(boundary.update).not.toHaveBeenCalled();
    expect(filter().params).toEqual(["verified-owner", "foreign"]);
  });
  it("clears focus and reports a missing profile safely", async () => {
    boundary.returning.mockResolvedValueOnce([{ userId: "verified-owner" }]);
    expect(await selectOwnedGoal("verified-owner", null)).toBe(true);
    expect(boundary.select).not.toHaveBeenCalled();
    expect(boundary.set).toHaveBeenCalledWith({ activeGoalId: null });
    expect(filter().params).toEqual(["verified-owner"]);
    expect(boundary.returning).toHaveBeenCalledExactlyOnceWith({
      userId: profiles.userId,
    });
    expect(await selectOwnedGoal("missing-owner", null)).toBe(false);
  });
});

describe("atomic saves and honest duplicate receipts", () => {
  it("saves a general class in the transaction without inventing an observation", async () => {
    boundary.returning.mockResolvedValue([{ id: "new-record" }]);
    expect(await saveOwnedClass("verified-owner", input)).toEqual({
      classId: "new-record",
      alreadySaved: false,
    });
    expect(boundary.transaction).toHaveBeenCalledOnce();
    expect(boundary.insert).toHaveBeenCalledExactlyOnceWith(trainingSessions);
    expect(boundary.values).toHaveBeenCalledWith({
      id: "new-record",
      userId: "verified-owner",
      submissionId: input.submissionId,
      date: input.date,
      mode: input.mode,
      technique: input.technique,
    });
    expect(boundary.onConflictDoNothing).toHaveBeenCalledWith({
      target: [trainingSessions.userId, trainingSessions.submissionId],
    });
    expect(boundary.select).not.toHaveBeenCalled();
  });
  it("saves an owned observation preserving unknown versus zero and personal text", async () => {
    boundary.returning.mockResolvedValue([{ id: "new-record" }]);
    boundary.limit.mockResolvedValue([{ id: "owned-goal" }]);
    const linked = {
      ...input,
      goalId: "owned-goal",
      outcome: "tried" as const,
      attempts: 0,
      successes: 0,
      obstacle: "  Sin espacio  ",
      nextCue: "  Frame  ",
    };
    expect(await saveOwnedClass("verified-owner", linked)).toEqual({
      classId: "new-record",
      alreadySaved: false,
    });
    expect(filter()).toEqual({
      sql: '("goals"."user_id" = $1 and "goals"."id" = $2)',
      params: ["verified-owner", "owned-goal"],
    });
    expect(boundary.insert).toHaveBeenNthCalledWith(2, goalObservations);
    expect(boundary.values).toHaveBeenNthCalledWith(2, {
      id: "new-record",
      userId: "verified-owner",
      classId: "new-record",
      goalId: "owned-goal",
      outcome: "tried",
      opportunities: null,
      attempts: 0,
      successes: 0,
      obstacle: "  Sin espacio  ",
      nextCue: "  Frame  ",
    });
  });
  it("throws a safe not-found error for a foreign goal and never writes an observation", async () => {
    boundary.returning.mockResolvedValue([{ id: "new-record" }]);
    const operation = saveOwnedClass("verified-owner", {
      ...input,
      goalId: "foreign",
      outcome: "tried",
    });
    await expect(operation).rejects.toMatchObject({
      name: "TrainingNotFoundError",
      message: "Training record not found",
    });
    await expect(operation).rejects.toBeInstanceOf(TrainingNotFoundError);
    expect(boundary.insert).toHaveBeenCalledTimes(1);
  });
  it("returns the original submission receipt without overwriting edited retries", async () => {
    boundary.limit.mockResolvedValue([{ id: "original-class" }]);
    expect(
      await saveOwnedClass("verified-owner", {
        ...input,
        technique: "Edited retry",
        goalId: "changed-goal",
        outcome: "tried",
      }),
    ).toEqual({ classId: "original-class", alreadySaved: true });
    expect(filter()).toEqual({
      sql: '("training_sessions"."user_id" = $1 and "training_sessions"."submission_id" = $2)',
      params: ["verified-owner", input.submissionId],
    });
    expect(boundary.insert).toHaveBeenCalledExactlyOnceWith(trainingSessions);
    expect(boundary.limit).toHaveBeenCalledWith(1);
    expect(boundary.update).not.toHaveBeenCalled();
  });
  it("does not manufacture success without an inserted class or original receipt", async () => {
    await expect(saveOwnedClass("verified-owner", input)).rejects.toThrow(
      "Class save failed",
    );
  });
  it("propagates ordinary persistence failure without a success receipt", async () => {
    boundary.transaction.mockRejectedValue(
      new Error("Synthetic database unavailable"),
    );
    await expect(saveOwnedClass("verified-owner", input)).rejects.toThrow(
      "Synthetic database unavailable",
    );
  });
});

describe("bounded owned history and read-only detail", () => {
  it("bounds a page to 25 while detecting older records and orders date/creation/ID", async () => {
    const records = Array.from({ length: 26 }, (_, index) => ({
      id: `owned-${index}`,
    }));
    boundary.limit.mockReturnValue(boundary);
    boundary.offset.mockResolvedValue(records);
    expect(await listOwnedHistory("verified-owner", 2)).toEqual({
      classes: records.slice(0, 25),
      hasMore: true,
    });
    expect(filter()).toEqual({
      sql: '"training_sessions"."user_id" = $1',
      params: ["verified-owner"],
    });
    expect(boundary.limit).toHaveBeenCalledWith(26);
    expect(boundary.offset).toHaveBeenCalledWith(50);
    expect(boundary.orderBy.mock.calls[0].map(query)).toEqual([
      { sql: '"training_sessions"."training_date" desc', params: [] },
      { sql: '"training_sessions"."created_at" desc', params: [] },
      { sql: '"training_sessions"."id" desc', params: [] },
    ]);
  });
  it("reports no older page for 25 records, empty history and the maximum allowed page", async () => {
    const records = Array.from({ length: 25 }, (_, index) => ({
      id: `owned-${index}`,
    }));
    boundary.limit.mockReturnValue(boundary);
    boundary.offset.mockResolvedValueOnce(records);
    expect(await listOwnedHistory("verified-owner", 0)).toEqual({
      classes: records,
      hasMore: false,
    });
    expect(boundary.offset).toHaveBeenCalledWith(0);
    expect(await listOwnedHistory("verified-owner", 10000)).toEqual({
      classes: [],
      hasMore: false,
    });
    expect(boundary.offset).toHaveBeenCalledWith(250000);
  });
  it.each([-1, 0.5, NaN, Infinity, 10001])(
    "rejects an invalid page %s before database access",
    async (page) => {
      await expect(listOwnedHistory("verified-owner", page)).rejects.toThrow(
        "Invalid history page",
      );
      expect(boundary.select).not.toHaveBeenCalled();
    },
  );
  it("joins details only through owned relationships and matches missing/foreign results", async () => {
    const detail = {
      class: { id: "own-class" },
      goal: null,
      observation: null,
    };
    boundary.limit.mockResolvedValueOnce([detail]);
    expect(await getOwnedClass("verified-owner", "own-class")).toBe(detail);
    expect(filter()).toEqual({
      sql: '("training_sessions"."user_id" = $1 and "training_sessions"."id" = $2)',
      params: ["verified-owner", "own-class"],
    });
    expect(query(boundary.leftJoin.mock.calls[0][1])).toEqual({
      sql: '("goal_observations"."class_id" = "training_sessions"."id" and "goal_observations"."user_id" = "training_sessions"."user_id")',
      params: [],
    });
    expect(query(boundary.leftJoin.mock.calls[1][1])).toEqual({
      sql: '("goals"."id" = "goal_observations"."goal_id" and "goals"."user_id" = "training_sessions"."user_id")',
      params: [],
    });
    expect(boundary.limit).toHaveBeenCalledWith(1);
    expect(await getOwnedClass("verified-owner", "foreign")).toBeNull();
    expect(await getOwnedClass("verified-owner", "missing")).toBeNull();
    expect(boundary.update).not.toHaveBeenCalled();
  });
});
