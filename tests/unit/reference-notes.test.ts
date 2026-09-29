import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { referenceNotes } from "@/db/schema";

const boundary = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  returning: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: boundary }));
vi.mock("@/lib/reference-store", () => ({ referenceExists: boundary.exists }));

import {
  deleteOwnNote,
  readOwnNote,
  ReferenceNotFoundError,
  saveOwnNote,
} from "@/lib/reference-notes";

function predicateAt(index: number) {
  return new PgDialect().sqlToQuery(boundary.where.mock.calls[index][0]);
}

beforeEach(() => {
  vi.resetAllMocks();
  for (const name of [
    "select",
    "from",
    "where",
    "insert",
    "values",
    "onConflictDoUpdate",
    "delete",
  ] as const) {
    boundary[name].mockReturnValue(boundary);
  }
  boundary.limit.mockResolvedValue([]);
  boundary.returning.mockResolvedValue([{ id: "saved" }]);
  boundary.exists.mockResolvedValue(true);
});

describe("owned reference notes", () => {
  it.each([
    {
      kind: "position" as const,
      referenceId: "closed-guard",
      column: '"reference_notes"."position_id"',
    },
    {
      kind: "technique" as const,
      referenceId: "closed-guard-frames",
      column: '"reference_notes"."technique_id"',
    },
  ])("reads only the verified owner's $kind note", async (target) => {
    const updatedAt = new Date("2026-09-28T10:00:00.000Z");
    boundary.limit.mockResolvedValueOnce([
      { body: " exact\ntext ", updatedAt },
    ]);
    expect(await readOwnNote("verified-owner", target)).toEqual({
      body: " exact\ntext ",
      updatedAt: updatedAt.toISOString(),
    });
    expect(boundary.from).toHaveBeenCalledWith(referenceNotes);
    expect(predicateAt(0)).toEqual({
      sql: `("reference_notes"."user_id" = $1 and ${target.column} = $2)`,
      params: ["verified-owner", target.referenceId],
      typings: ["none", "none"],
    });
  });

  it("returns null for an absent owned note", async () => {
    expect(
      await readOwnNote("verified-owner", {
        kind: "position",
        referenceId: "closed-guard",
      }),
    ).toBeNull();
  });

  it.each(["position", "technique"] as const)(
    "upserts one %s note with only body and timestamp updated",
    async (kind) => {
      const input = { kind, referenceId: "target", body: "  exact body\n  " };
      await saveOwnNote("verified-owner", input);
      expect(boundary.exists).toHaveBeenCalledExactlyOnceWith(input);
      expect(boundary.insert).toHaveBeenCalledExactlyOnceWith(referenceNotes);
      expect(boundary.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "verified-owner",
          positionId: kind === "position" ? "target" : null,
          techniqueId: kind === "technique" ? "target" : null,
          body: input.body,
        }),
      );
      expect(boundary.onConflictDoUpdate).toHaveBeenCalledWith({
        target: [
          referenceNotes.userId,
          kind === "position"
            ? referenceNotes.positionId
            : referenceNotes.techniqueId,
        ],
        set: { body: input.body, updatedAt: expect.any(Date) },
      });
    },
  );

  it("does not report a successful save without a persisted row", async () => {
    boundary.returning.mockResolvedValue([]);
    await expect(
      saveOwnNote("verified-owner", {
        kind: "position",
        referenceId: "closed-guard",
        body: "note",
      }),
    ).rejects.toThrow("Reference note save failed");
  });

  it("refuses a missing shared target before an insert or delete", async () => {
    boundary.exists.mockResolvedValue(false);
    const target = { kind: "position" as const, referenceId: "missing" };
    await expect(
      saveOwnNote("verified-owner", { ...target, body: "note" }),
    ).rejects.toBeInstanceOf(ReferenceNotFoundError);
    await expect(
      deleteOwnNote("verified-owner", target),
    ).rejects.toBeInstanceOf(ReferenceNotFoundError);
    expect(boundary.insert).not.toHaveBeenCalled();
    expect(boundary.delete).not.toHaveBeenCalled();
  });

  it("deletes by owner and target and succeeds when no note exists", async () => {
    const target = { kind: "technique" as const, referenceId: "target" };
    await expect(
      deleteOwnNote("verified-owner", target),
    ).resolves.toBeUndefined();
    expect(boundary.delete).toHaveBeenCalledWith(referenceNotes);
    expect(predicateAt(0).params).toEqual(["verified-owner", "target"]);
  });
});
