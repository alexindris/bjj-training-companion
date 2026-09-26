import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const boundary = vi.hoisted(() => ({
  headers: vi.fn(),
  getSession: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (callback: unknown) => callback }));
vi.mock("next/headers", () => ({ headers: boundary.headers }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: boundary.getSession } },
}));
vi.mock("@/db", () => ({ db: { select: boundary.select } }));

import { getOwnProfile, getSession } from "@/lib/session";

beforeEach(() => {
  vi.resetAllMocks();
  boundary.headers.mockResolvedValue(
    new Headers({ cookie: "better-auth.session_token=browser-session" }),
  );
  boundary.select.mockReturnValue({ from: boundary.from });
  boundary.from.mockReturnValue({ where: boundary.where });
  boundary.where.mockReturnValue({ limit: boundary.limit });
});

describe("verified request identity", () => {
  it("uses Better Auth session verification with the incoming cookies", async () => {
    const verified = { user: { id: "verified-user", name: "First user" } };
    boundary.getSession.mockResolvedValue(verified);
    expect(await getSession()).toBe(verified);
    const { headers } = boundary.getSession.mock.calls[0]?.[0] as {
      headers: Headers;
    };
    expect(headers.get("cookie")).toBe(
      "better-auth.session_token=browser-session",
    );
  });

  it("does not invent an identity when Better Auth returns no session", async () => {
    boundary.getSession.mockResolvedValue(null);
    expect(await getSession()).toBeNull();
  });

  it("propagates session verification failure", async () => {
    boundary.getSession.mockRejectedValue(new Error("verification failed"));
    await expect(getSession()).rejects.toThrow("verification failed");
  });

  it("reads only the requested account profile", async () => {
    const own = { userId: "first-user", locale: "es" };
    const other = { userId: "second-user", locale: "en" };
    boundary.limit.mockResolvedValue([own, other]);
    expect(await getOwnProfile("first-user")).toBe(own);
    const predicate = boundary.where.mock.calls[0]?.[0];
    expect(new PgDialect().sqlToQuery(predicate)).toMatchObject({
      sql: '"profiles"."user_id" = $1',
      params: ["first-user"],
    });
    expect(boundary.limit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("returns no profile when the account has none", async () => {
    boundary.limit.mockResolvedValue([]);
    expect(await getOwnProfile("first-user")).toBeUndefined();
  });
});
