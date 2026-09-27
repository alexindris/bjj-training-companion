import "server-only";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getOwnProfile, getSession } from "./session";
import { getActiveGoal, listGoals } from "./training-store";

export async function getTrainingContext(locale: string) {
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await getSession();
  if (!session) return redirect({ href: "/sign-in", locale });
  const [profile, goals, activeGoal] = await Promise.all([
    getOwnProfile(session.user.id),
    listGoals(session.user.id),
    getActiveGoal(session.user.id),
  ]);
  return { session, profile, goals, activeGoal };
}
