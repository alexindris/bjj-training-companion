"use server";

import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getOwnProfile, getSession } from "@/lib/session";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { readEnv } from "@/lib/env";

export type SignInState = {
  error?: "invalidInput" | "invalidCredentials" | "unavailable" | "rateLimited";
};
const credentials = z.object({
  email: z.email(),
  password: z.string().min(12).max(128),
  locale: z.enum(["en", "es"]),
});

async function rememberLocale(locale: Locale) {
  (await cookies()).set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.BETTER_AUTH_URL?.startsWith("https://") ?? false,
  });
}

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalidInput" };
  let locale: Locale = parsed.data.locale;
  try {
    // Use the full HTTP handler so Better Auth's origin checks and rate limiter
    // also run for this progressively enhanced Server Action form.
    const incoming = await headers();
    const requestHeaders = new Headers(incoming);
    requestHeaders.set("content-type", "application/json");
    requestHeaders.delete("content-length");
    const response = await auth.handler(
      new Request(
        new URL("/api/auth/sign-in/email", readEnv().BETTER_AUTH_URL),
        {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify({
            email: parsed.data.email,
            password: parsed.data.password,
          }),
        },
      ),
    );
    if (response.status === 429) return { error: "rateLimited" };
    if (response.status === 401 || response.status === 400)
      return { error: "invalidCredentials" };
    if (!response.ok) return { error: "unavailable" };
    const result = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await response.json());
    const profile = await getOwnProfile(result.user.id);
    if (profile?.locale === "en" || profile?.locale === "es")
      locale = profile.locale;
    const cookieStore = await cookies();
    for (const [name, attributes] of parseSetCookieHeader(
      response.headers.get("set-cookie") ?? "",
    )) {
      cookieStore.set(name, attributes.value, toCookieOptions(attributes));
    }
    await rememberLocale(locale);
  } catch {
    return { error: "unavailable" };
  }
  return redirect({ href: "/", locale });
}

export async function signOut(locale: Locale) {
  const parsed = z.enum(["en", "es"]).parse(locale);
  await auth.api.signOut({ headers: await headers() });
  redirect({ href: "/sign-in", locale: parsed });
}

export async function changeLocale(
  value: unknown,
): Promise<{ success: boolean }> {
  const parsed = z.enum(["en", "es"]).safeParse(value);
  if (!parsed.success) return { success: false };
  try {
    const session = await getSession();
    if (session) {
      // Ownership comes only from the verified session, never from form input.
      await db
        .update(profiles)
        .set({ locale: parsed.data })
        .where(eq(profiles.userId, session.user.id));
    }
    await rememberLocale(parsed.data);
    return { success: true };
  } catch {
    return { success: false };
  }
}
