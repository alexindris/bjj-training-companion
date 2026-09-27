import { getTranslations } from "next-intl/server";
import { getTrainingContext } from "@/lib/training-queries";
import { AppShell } from "@/components/app-shell";
import { ClassForm } from "@/components/class-form";

export default async function LogClass({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { session, profile, goals, activeGoal } =
    await getTrainingContext(locale);
  const t = await getTranslations("Log");
  return (
    <AppShell current="log" name={session.user.name}>
      <p className="eyebrow text-teal-800">{t("eyebrow")}</p>
      <h1 className="display mt-4 text-4xl sm:text-5xl">{t("title")}</h1>
      <p className="mt-5 mb-8 max-w-xl text-sm leading-6 text-stone-600">
        {t("description")}
      </p>
      <ClassForm
        key={session.user.id}
        userId={session.user.id}
        mode={profile?.trainingMode === "no-gi" ? "no-gi" : "gi"}
        goals={goals}
        activeGoalId={activeGoal?.id ?? null}
      />
    </AppShell>
  );
}
