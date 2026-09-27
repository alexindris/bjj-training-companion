import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowRight, Sprout, ShieldCheck } from "lucide-react";
import { getTrainingContext } from "@/lib/training-queries";
import { FocusButton } from "@/components/goals-panel";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export default async function Today({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const { session, profile, activeGoal } = await getTrainingContext(locale);
  const t = await getTranslations("Today");
  return (
    <AppShell current="today" name={session.user.name}>
      <p className="eyebrow text-teal-800">{t("eyebrow")}</p>
      <h1 className="display mt-4 max-w-2xl text-4xl leading-[1.1] sm:text-5xl">
        {t("title")}
      </h1>
      <p className="mt-5 text-sm font-medium">
        {t("welcome", { name: session.user.name })}
      </p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
        {t("description")}
      </p>
      <div className="mt-10 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-[#cfddd3] bg-[#edf3ed] p-7 sm:p-9">
          <p className="eyebrow text-teal-800">{t("focusLabel")}</p>
          <Sprout
            className="my-8 text-teal-800"
            size={36}
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <h2 className="display max-w-sm text-3xl break-words whitespace-pre-wrap">
            {activeGoal?.title ?? t("focusTitle")}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 break-words whitespace-pre-wrap text-stone-600">
            {activeGoal ? activeGoal.notes : t("focusDescription")}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/log">{t("logClass")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/goals">{t("chooseFocus")}</Link>
            </Button>
            {activeGoal && <FocusButton goalId={null} clear />}
          </div>
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-7 sm:p-9">
          <ShieldCheck size={25} className="text-teal-800" aria-hidden="true" />
          <h2 className="mt-5 text-lg font-semibold">{t("accountTitle")}</h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {t("accountDescription")}
          </p>
          <dl className="mt-7 space-y-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">{t("languageLabel")}</dt>
              <dd>{t(locale === "es" ? "locale-es" : "locale-en")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">{t("referenceLabel")}</dt>
              <dd>{t("referenceValue")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">{t("modeLabel")}</dt>
              <dd>
                {t(
                  profile?.trainingMode === "no-gi" ? "mode-no-gi" : "mode-gi",
                )}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <section className="mt-6 flex flex-col justify-between gap-6 rounded-2xl border border-stone-200 bg-white p-7 sm:flex-row sm:items-center sm:p-9">
        <div>
          <p className="eyebrow mb-3 text-stone-500">{t("preview")}</p>
          <h2 className="text-lg font-semibold">{t("libraryTitle")}</h2>
          <p className="mt-2 text-sm text-stone-600">
            {t("libraryDescription")}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/library">
            {t("browse")}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </AppShell>
  );
}
