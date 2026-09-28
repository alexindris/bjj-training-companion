import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  getSession: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSession: boundary.getSession }));
vi.mock("next/cache", () => ({ revalidatePath: boundary.revalidate }));
vi.mock("@/lib/reference-notes", () => ({
  saveOwnNote: boundary.save,
  deleteOwnNote: boundary.remove,
  ReferenceNotFoundError: class extends Error {},
}));

import {
  deleteReferenceNote,
  saveReferenceNote,
} from "@/app/reference-actions";
import { ReferenceNotFoundError } from "@/lib/reference-notes";

const target = { kind: "position", referenceId: "closed-guard" };
const input = { ...target, body: "  Técnica\n<script>literal</script>  " };

beforeEach(() => {
  vi.resetAllMocks();
  boundary.getSession.mockResolvedValue({ user: { id: "verified-owner" } });
});

describe("reference note actions", () => {
  it("takes ownership from the verified session and preserves the submitted body", async () => {
    expect(await saveReferenceNote(input)).toEqual({ saved: true });
    expect(boundary.save).toHaveBeenCalledExactlyOnceWith(
      "verified-owner",
      input,
    );
    expect(boundary.revalidate).toHaveBeenCalledExactlyOnceWith(
      "/[locale]/library/[kind]/[id]",
      "page",
    );
  });

  it("deletes only through the verified owner's target", async () => {
    expect(await deleteReferenceNote(target)).toEqual({ deleted: true });
    expect(boundary.remove).toHaveBeenCalledExactlyOnceWith(
      "verified-owner",
      target,
    );
    expect(boundary.revalidate).toHaveBeenCalledExactlyOnceWith(
      "/[locale]/library/[kind]/[id]",
      "page",
    );
  });

  it.each([saveReferenceNote, deleteReferenceNote])(
    "requires a session before parsing or persistence",
    async (action) => {
      boundary.getSession.mockResolvedValue(null);
      expect(await action({ ...input, userId: "other" })).toEqual({
        error: "unauthenticated",
      });
      expect(boundary.save).not.toHaveBeenCalled();
      expect(boundary.remove).not.toHaveBeenCalled();
    },
  );

  it.each([saveReferenceNote, deleteReferenceNote])(
    "rejects forged owner and note ID fields",
    async (action) => {
      for (const forged of [
        { ...input, userId: "other" },
        { ...input, noteId: "other" },
      ]) {
        expect((await action(forged)).error).toBe("invalidInput");
      }
      expect(boundary.save).not.toHaveBeenCalled();
      expect(boundary.remove).not.toHaveBeenCalled();
    },
  );

  it("rejects blank and overlong notes with stable field codes", async () => {
    expect(
      (await saveReferenceNote({ ...input, body: " \n " })).fieldErrors,
    ).toEqual({
      body: ["requiredNote"],
    });
    expect(
      (await saveReferenceNote({ ...input, body: "x".repeat(5001) }))
        .fieldErrors,
    ).toEqual({ body: ["noteTooLong"] });
    expect(boundary.save).not.toHaveBeenCalled();
  });

  it.each([saveReferenceNote, deleteReferenceNote])(
    "returns a safe missing-reference code",
    async (action) => {
      boundary.save.mockRejectedValue(new ReferenceNotFoundError());
      boundary.remove.mockRejectedValue(new ReferenceNotFoundError());
      expect(
        await action(action === saveReferenceNote ? input : target),
      ).toEqual({
        error: "notFound",
      });
      expect(boundary.revalidate).not.toHaveBeenCalled();
    },
  );

  it.each([saveReferenceNote, deleteReferenceNote])(
    "sanitizes session and database failures",
    async (action) => {
      boundary.getSession.mockRejectedValueOnce(new Error("secret"));
      const payload = action === saveReferenceNote ? input : target;
      expect(await action(payload)).toEqual({ error: "unavailable" });
      boundary.save.mockRejectedValue(new Error("private SQL"));
      boundary.remove.mockRejectedValue(new Error("private SQL"));
      expect(await action(payload)).toEqual({ error: "unavailable" });
      expect(boundary.revalidate).not.toHaveBeenCalled();
    },
  );
});
