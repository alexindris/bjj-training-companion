import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BetterAuthOptions } from "better-auth";

const boundary = vi.hoisted(() => ({
  configuration: undefined as BetterAuthOptions | undefined,
  insert: vi.fn(),
  values: vi.fn(),
  onConflictDoNothing: vi.fn(),
}));
vi.mock("better-auth/minimal", () => ({
  betterAuth: (configuration: BetterAuthOptions) => {
    boundary.configuration = configuration;
    return { marker: "configured-auth" };
  },
}));
vi.mock("@better-auth/drizzle-adapter", () => ({
  drizzleAdapter: () => "drizzle-adapter",
}));
vi.mock("better-auth/next-js", () => ({
  nextCookies: () => ({ id: "next-cookies" }),
}));
vi.mock("@/lib/env", () => ({
  readEnv: () => ({
    BETTER_AUTH_URL: "http://127.0.0.1:3000",
    BETTER_AUTH_SECRET: "synthetic-auth-secret-of-at-least-32-characters",
  }),
}));
vi.mock("@/db", () => ({ db: { insert: boundary.insert } }));

import { auth } from "@/lib/auth";
import { profiles } from "@/db/schema";

beforeEach(() => {
  vi.clearAllMocks();
  boundary.insert.mockReturnValue({ values: boundary.values });
  boundary.values.mockReturnValue({
    onConflictDoNothing: boundary.onConflictDoNothing,
  });
  boundary.onConflictDoNothing.mockResolvedValue(undefined);
});

describe("application auth configuration", () => {
  it("uses the configured local origin, password policy, rate limiter, and Next cookie bridge", () => {
    expect(auth).toEqual({ marker: "configured-auth" });
    expect(boundary.configuration).toMatchObject({
      baseURL: "http://127.0.0.1:3000",
      trustedOrigins: ["http://127.0.0.1:3000"],
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 12,
        autoSignIn: false,
      },
      session: { expiresIn: 604800, updateAge: 86400 },
      rateLimit: {
        enabled: true,
        customRules: { "/sign-in/email": { window: 60, max: 10 } },
      },
      plugins: [{ id: "next-cookies" }],
    });
  });

  it("provisions a default profile for the new authenticated account without overwriting existing preferences", async () => {
    const hook = boundary.configuration?.databaseHooks?.user?.create?.after;
    expect(hook).toBeDefined();
    await hook?.(
      {
        id: "new-user",
        name: "Test user",
        email: "new@example.test",
        emailVerified: false,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      null,
    );
    expect(boundary.insert).toHaveBeenCalledExactlyOnceWith(profiles);
    expect(boundary.values).toHaveBeenCalledExactlyOnceWith({
      userId: "new-user",
    });
    expect(boundary.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("propagates a failed profile provision so auth cannot silently ignore it", async () => {
    boundary.onConflictDoNothing.mockRejectedValue(
      new Error("profile database unavailable"),
    );
    const hook = boundary.configuration?.databaseHooks?.user?.create?.after;
    await expect(
      hook?.(
        {
          id: "new-user",
          name: "Test user",
          email: "new@example.test",
          emailVerified: false,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
        null,
      ),
    ).rejects.toThrow("profile database unavailable");
  });
});
