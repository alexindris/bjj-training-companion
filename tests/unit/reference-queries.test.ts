import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  session: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  exists: vi.fn(),
  note: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: boundary.session }));
vi.mock("@/lib/reference-store", () => ({
  listReferences: boundary.list,
  getReferenceDetail: boundary.detail,
  referenceExists: boundary.exists,
}));
vi.mock("@/lib/reference-notes", () => ({ readOwnNote: boundary.note }));
vi.mock("@/i18n/navigation", () => ({ redirect: boundary.redirect }));
vi.mock("next/navigation", () => ({ notFound: boundary.notFound }));

import {
  getReferenceDetailContext,
  getReferenceListContext,
} from "@/lib/reference-queries";

beforeEach(() => {
  vi.resetAllMocks();
  boundary.session.mockResolvedValue({ user: { id: "verified-owner" } });
  boundary.list.mockResolvedValue({ items: [], hasMore: false });
  boundary.exists.mockResolvedValue(true);
  boundary.detail.mockResolvedValue({ reference: { id: "closed-guard" } });
  boundary.note.mockResolvedValue({
    body: "mine",
    updatedAt: "2026-09-28T10:00:00.000Z",
  });
  boundary.notFound.mockImplementation(() => {
    throw new Error("notFound");
  });
  boundary.redirect.mockImplementation(() => {
    throw new Error("redirect");
  });
});

describe("verified reference reads", () => {
  it("rejects an unsupported locale before authentication or storage", async () => {
    await expect(getReferenceListContext("fr", {})).rejects.toThrow("notFound");
    expect(boundary.session).not.toHaveBeenCalled();
    expect(boundary.list).not.toHaveBeenCalled();
  });

  it("checks a real session before any shared or private read", async () => {
    boundary.session.mockResolvedValue(null);
    await expect(getReferenceListContext("en", {})).rejects.toThrow("redirect");
    expect(boundary.redirect).toHaveBeenCalledWith({
      href: "/sign-in",
      locale: "en",
    });
    await expect(
      getReferenceDetailContext("en", "position", "closed-guard"),
    ).rejects.toThrow("redirect");
    expect(boundary.list).not.toHaveBeenCalled();
    expect(boundary.detail).not.toHaveBeenCalled();
    expect(boundary.note).not.toHaveBeenCalled();
  });

  it("returns an invalid state without querying malformed search", async () => {
    const result = await getReferenceListContext("en", { q: ["a", "b"] });
    expect(result.state).toBeNull();
    expect(result.results).toBeNull();
    expect(boundary.list).not.toHaveBeenCalled();
  });

  it("checks contextual parent existence before listing", async () => {
    boundary.exists.mockResolvedValue(false);
    const result = await getReferenceListContext("en", {
      position: "missing",
    });
    expect(result.state).toBeNull();
    expect(boundary.exists).toHaveBeenCalledWith({
      kind: "position",
      referenceId: "missing",
    });
    expect(boundary.list).not.toHaveBeenCalled();
  });

  it("lists a valid contextual parent with technique-only state", async () => {
    const result = await getReferenceListContext("en", {
      position: "closed-guard",
    });
    expect(boundary.exists).toHaveBeenCalledWith({
      kind: "position",
      referenceId: "closed-guard",
    });
    expect(boundary.list).toHaveBeenCalledWith({
      query: "",
      type: "technique",
      page: 0,
      positionId: "closed-guard",
    });
    expect(result.results).toEqual({ items: [], hasMore: false });
  });

  it("passes validated search to the bounded store", async () => {
    const result = await getReferenceListContext("es", {
      q: " Frame ",
      type: "technique",
      page: "2",
    });
    expect(boundary.list).toHaveBeenCalledWith({
      query: "Frame",
      type: "technique",
      page: 2,
      positionId: null,
    });
    expect(result.results).toEqual({ items: [], hasMore: false });
  });

  it("reads only the verified account's note for a valid detail", async () => {
    const result = await getReferenceDetailContext(
      "en",
      "position",
      "closed-guard",
    );
    expect(boundary.note).toHaveBeenCalledExactlyOnceWith("verified-owner", {
      kind: "position",
      referenceId: "closed-guard",
    });
    expect(result.note?.body).toBe("mine");
  });

  it("never reads notes for invalid or missing shared references", async () => {
    await expect(
      getReferenceDetailContext("en", "video", "closed-guard"),
    ).rejects.toThrow("notFound");
    boundary.detail.mockResolvedValue(null);
    await expect(
      getReferenceDetailContext("en", "position", "missing"),
    ).rejects.toThrow("notFound");
    expect(boundary.note).not.toHaveBeenCalled();
  });
});
