import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const boundary = vi.hoisted(() => ({
  handler: vi.fn(),
  signOut: vi.fn(),
  headers: vi.fn(),
  cookies: vi.fn(),
  setCookie: vi.fn(),
  getSession: vi.fn(),
  getOwnProfile: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: { handler: boundary.handler, api: { signOut: boundary.signOut } },
}));
vi.mock("next/headers", () => ({
  headers: boundary.headers,
  cookies: boundary.cookies,
}));
vi.mock("@/lib/session", () => ({
  getSession: boundary.getSession,
  getOwnProfile: boundary.getOwnProfile,
}));
vi.mock("@/db", () => ({ db: { update: boundary.update } }));
vi.mock("@/i18n/navigation", () => ({ redirect: boundary.redirect }));

import { changeLocale, signIn, signOut } from "@/app/actions";

const redirected = new Error("Next redirect");
const dialect = new PgDialect();

function credentials(overrides: Record<string, string | undefined> = {}) {
  const values = {
    email: "first@example.test",
    password: "synthetic-password",
    locale: "en",
    ...overrides,
  };
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) form.set(name, value);
  }
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1:5432/test");
  vi.stubEnv("BETTER_AUTH_URL", "http://127.0.0.1:3000");
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "synthetic-auth-secret-of-at-least-32-characters",
  );
  boundary.headers.mockResolvedValue(
    new Headers({
      origin: "http://127.0.0.1:3000",
      cookie: "existing=browser-cookie",
      "content-length": "999",
      "x-forwarded-for": "127.0.0.1",
    }),
  );
  boundary.cookies.mockResolvedValue({ set: boundary.setCookie });
  boundary.getOwnProfile.mockResolvedValue({ locale: "es" });
  boundary.getSession.mockResolvedValue(null);
  boundary.handler.mockResolvedValue(
    Response.json(
      { user: { id: "verified-first" } },
      {
        headers: {
          "set-cookie":
            "better-auth.session_token=session-one; Path=/; HttpOnly; SameSite=Lax, better-auth.session_data=data-one; Path=/; HttpOnly; SameSite=Lax",
        },
      },
    ),
  );
  boundary.update.mockReturnValue({ set: boundary.set });
  boundary.set.mockReturnValue({ where: boundary.where });
  boundary.where.mockResolvedValue(undefined);
  boundary.redirect.mockImplementation(() => {
    throw redirected;
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("sign-in action", () => {
  it.each([
    { email: "not-an-email" },
    { password: "short" },
    { password: "x".repeat(129) },
    { locale: "fr" },
  ])("rejects invalid input before authentication: %j", async (invalid) => {
    expect(await signIn({}, credentials(invalid))).toEqual({
      error: "invalidInput",
    });
    expect(boundary.handler).not.toHaveBeenCalled();
    expect(boundary.setCookie).not.toHaveBeenCalled();
  });

  it("forwards browser security headers to the full authentication handler", async () => {
    await expect(signIn({}, credentials())).rejects.toBe(redirected);
    const request = boundary.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://127.0.0.1:3000/api/auth/sign-in/email");
    expect(request.method).toBe("POST");
    expect(request.headers.get("origin")).toBe("http://127.0.0.1:3000");
    expect(request.headers.get("cookie")).toBe("existing=browser-cookie");
    expect(request.headers.get("x-forwarded-for")).toBe("127.0.0.1");
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(request.headers.has("content-length")).toBe(false);
    expect(await request.json()).toEqual({
      email: "first@example.test",
      password: "synthetic-password",
    });
  });

  it.each([12, 128])(
    "accepts the documented password length boundary %i",
    async (length) => {
      await expect(
        signIn({}, credentials({ password: "x".repeat(length) })),
      ).rejects.toBe(redirected);
      expect(boundary.handler).toHaveBeenCalledOnce();
    },
  );

  it.each([
    [400, "invalidCredentials"],
    [401, "invalidCredentials"],
    [429, "rateLimited"],
    [403, "unavailable"],
    [500, "unavailable"],
  ])("returns a safe UI error for auth status %i", async (status, error) => {
    boundary.handler.mockResolvedValue(
      new Response("sensitive provider detail", { status }),
    );
    expect(await signIn({}, credentials())).toEqual({ error });
    expect(boundary.getOwnProfile).not.toHaveBeenCalled();
    expect(boundary.setCookie).not.toHaveBeenCalled();
    expect(boundary.redirect).not.toHaveBeenCalled();
  });

  it.each([403, 500])(
    "rejects an unsuccessful auth status %i even with a valid-looking identity body",
    async (status) => {
      boundary.handler.mockResolvedValue(
        Response.json({ user: { id: "verified-first" } }, { status }),
      );
      expect(await signIn({}, credentials())).toEqual({ error: "unavailable" });
      expect(boundary.getOwnProfile).not.toHaveBeenCalled();
      expect(boundary.setCookie).not.toHaveBeenCalled();
      expect(boundary.redirect).not.toHaveBeenCalled();
    },
  );

  it("applies every auth cookie and uses the verified user's persisted language", async () => {
    const form = credentials({
      userId: "attacker-controlled-id",
      locale: "en",
    });
    await expect(signIn({}, form)).rejects.toBe(redirected);
    expect(boundary.getOwnProfile).toHaveBeenCalledExactlyOnceWith(
      "verified-first",
    );
    expect(boundary.setCookie).toHaveBeenCalledWith(
      "better-auth.session_token",
      "session-one",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    expect(boundary.setCookie).toHaveBeenCalledWith(
      "better-auth.session_data",
      "data-one",
      expect.objectContaining({ httpOnly: true }),
    );
    expect(boundary.setCookie).toHaveBeenCalledWith("NEXT_LOCALE", "es", {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: true,
      secure: false,
    });
    expect(boundary.redirect).toHaveBeenCalledExactlyOnceWith({
      href: "/",
      locale: "es",
    });
  });

  it.each([undefined, { locale: "unsupported" }])(
    "keeps the form language when no supported preference exists",
    async (profile) => {
      boundary.getOwnProfile.mockResolvedValue(profile);
      boundary.handler.mockResolvedValue(
        Response.json({ user: { id: "verified-first" } }),
      );
      await expect(signIn({}, credentials({ locale: "es" }))).rejects.toBe(
        redirected,
      );
      expect(boundary.setCookie).toHaveBeenCalledTimes(1);
      expect(boundary.setCookie).toHaveBeenCalledWith(
        "NEXT_LOCALE",
        "es",
        expect.any(Object),
      );
      expect(boundary.redirect).toHaveBeenCalledWith({
        href: "/",
        locale: "es",
      });
    },
  );

  it("accepts an English stored preference regardless of the Spanish form language", async () => {
    boundary.getOwnProfile.mockResolvedValue({ locale: "en" });
    await expect(signIn({}, credentials({ locale: "es" }))).rejects.toBe(
      redirected,
    );
    expect(boundary.redirect).toHaveBeenCalledWith({ href: "/", locale: "en" });
  });

  it.each([Response.json({ user: { id: 123 } }), new Response("not JSON")])(
    "does not trust malformed successful responses",
    async (response) => {
      boundary.handler.mockResolvedValue(response);
      expect(await signIn({}, credentials())).toEqual({ error: "unavailable" });
      expect(boundary.setCookie).not.toHaveBeenCalled();
    },
  );

  it("does not redirect or reveal provider errors when authentication throws", async () => {
    boundary.handler.mockRejectedValue(
      new Error("private credential diagnostic"),
    );
    expect(await signIn({}, credentials())).toEqual({ error: "unavailable" });
    expect(boundary.redirect).not.toHaveBeenCalled();
  });

  it("reports failed profile lookup as unavailable instead of claiming successful sign-in", async () => {
    boundary.getOwnProfile.mockRejectedValue(new Error("database unavailable"));
    expect(await signIn({}, credentials())).toEqual({ error: "unavailable" });
    expect(boundary.setCookie).not.toHaveBeenCalled();
  });
});

describe("sign-out action", () => {
  it.each(["en", "es"] as const)(
    "revokes the current browser session before redirecting to %s sign-in",
    async (locale) => {
      await expect(signOut(locale)).rejects.toBe(redirected);
      const incoming = await boundary.headers.mock.results[0]?.value;
      expect(boundary.signOut).toHaveBeenCalledExactlyOnceWith({
        headers: incoming,
      });
      expect(boundary.redirect).toHaveBeenCalledExactlyOnceWith({
        href: "/sign-in",
        locale,
      });
      expect(boundary.signOut.mock.invocationCallOrder[0]).toBeLessThan(
        boundary.redirect.mock.invocationCallOrder[0] as number,
      );
    },
  );

  it("validates the locale before contacting auth", async () => {
    await expect(signOut("fr" as "en")).rejects.toThrow();
    expect(boundary.signOut).not.toHaveBeenCalled();
  });

  it("does not claim logout succeeded when auth fails", async () => {
    const failure = new Error("auth unavailable");
    boundary.signOut.mockRejectedValue(failure);
    await expect(signOut("en")).rejects.toBe(failure);
    expect(boundary.redirect).not.toHaveBeenCalled();
  });
});

describe("language preference action", () => {
  it.each(["fr", "", null, { locale: "es", userId: "another-user" }])(
    "rejects unsupported or forged input: %j",
    async (value) => {
      expect(await changeLocale(value)).toEqual({ success: false });
      expect(boundary.getSession).not.toHaveBeenCalled();
      expect(boundary.update).not.toHaveBeenCalled();
      expect(boundary.setCookie).not.toHaveBeenCalled();
    },
  );

  it("lets a visitor remember a language without writing any account", async () => {
    expect(await changeLocale("es")).toEqual({ success: true });
    expect(boundary.update).not.toHaveBeenCalled();
    expect(boundary.setCookie).toHaveBeenCalledWith(
      "NEXT_LOCALE",
      "es",
      expect.objectContaining({ secure: false }),
    );
  });

  it.each(["en", "es"] as const)(
    "persists %s only for the verified account",
    async (locale) => {
      const records = new Map([
        ["verified-first", "en"],
        ["second-user", "en"],
      ]);
      boundary.getSession.mockResolvedValue({ user: { id: "verified-first" } });
      boundary.where.mockImplementation(async (predicate: SQL) => {
        const query = dialect.sqlToQuery(predicate);
        expect(query.sql).toBe('"profiles"."user_id" = $1');
        for (const id of records.keys()) {
          if (id === query.params[0]) records.set(id, locale);
        }
      });
      expect(await changeLocale(locale)).toEqual({ success: true });
      expect(boundary.set).toHaveBeenCalledExactlyOnceWith({ locale });
      expect(records.get("verified-first")).toBe(locale);
      expect(records.get("second-user")).toBe("en");
      expect(boundary.setCookie).toHaveBeenCalledWith(
        "NEXT_LOCALE",
        locale,
        expect.any(Object),
      );
    },
  );

  it("does not update a locale cookie if persistence fails", async () => {
    boundary.getSession.mockResolvedValue({ user: { id: "verified-first" } });
    boundary.where.mockRejectedValue(new Error("database unavailable"));
    expect(await changeLocale("es")).toEqual({ success: false });
    expect(boundary.setCookie).not.toHaveBeenCalled();
  });

  it("does not turn session verification failures into visitor updates", async () => {
    boundary.getSession.mockRejectedValue(new Error("invalid session"));
    expect(await changeLocale("es")).toEqual({ success: false });
    expect(boundary.update).not.toHaveBeenCalled();
    expect(boundary.setCookie).not.toHaveBeenCalled();
  });

  it("reports cookie failures and uses HTTPS-only cookies on HTTPS", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://localhost:3000");
    boundary.setCookie.mockImplementation(() => {
      throw new Error("cookie unavailable");
    });
    expect(await changeLocale("en")).toEqual({ success: false });
    expect(boundary.setCookie).toHaveBeenCalledWith(
      "NEXT_LOCALE",
      "en",
      expect.objectContaining({ secure: true }),
    );
  });

  it("handles an absent auth URL safely for visitor locale cookies", async () => {
    vi.stubEnv("BETTER_AUTH_URL", undefined);
    expect(await changeLocale("en")).toEqual({ success: true });
    expect(boundary.setCookie).toHaveBeenCalledWith(
      "NEXT_LOCALE",
      "en",
      expect.objectContaining({ secure: false }),
    );
  });
});
