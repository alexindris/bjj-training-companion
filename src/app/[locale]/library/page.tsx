import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { routing } from "@/i18n/routing";
import { redirect } from "@/i18n/navigation";
import { db } from "@/db";
import { referencePositions } from "@/db/schema";
import { AppShell } from "@/components/app-shell";

export default async function Library({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await getSession();
  if (!session) return redirect({ href: "/sign-in", locale });
  const t = await getTranslations("Library");
  const positions = await db
    .select()
    .from(referencePositions)
    .orderBy(asc(referencePositions.id));
  return (
    <AppShell current="library" name={session.user.name}>
      <p className="eyebrow text-teal-800">{t("eyebrow")}</p>
      <h1 className="display mt-4 text-4xl sm:text-5xl">{t("title")}</h1>
      <p className="mt-5 max-w-xl text-sm leading-6 text-stone-600">
        {t("description")}
      </p>
      <div className="mt-9 grid gap-5 sm:grid-cols-2">
        {positions.map((position, index) => (
          <article
            key={position.id}
            className="rounded-2xl border border-stone-200 bg-white p-7"
          >
            <span className="eyebrow text-teal-800">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div lang="en">
              <h2 className="display mt-5 text-3xl">{position.title}</h2>
              <p className="mt-4 text-sm leading-6 text-stone-600">
                {position.description}
              </p>
            </div>
            <p className="mt-6 text-xs text-stone-500">{t("original")}</p>
          </article>
        ))}
      </div>
      <p className="mt-8 text-xs leading-5 text-stone-500">{t("scope")}</p>
    </AppShell>
  );
}
