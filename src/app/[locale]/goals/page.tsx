import { getTranslations } from "next-intl/server";
import { getTrainingContext } from "@/lib/training-queries";
import { AppShell } from "@/components/app-shell";
import { GoalForm, GoalsList } from "@/components/goals-panel";

export default async function Goals({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { session, goals, activeGoal } = await getTrainingContext(locale);
  const t = await getTranslations("Goals");
  return (
    <AppShell current="goals" name={session.user.name}>
      <p className="eyebrow text-teal-800">{t("eyebrow")}</p>
      <h1 className="display mt-4 text-4xl sm:text-5xl">{t("title")}</h1>
      <p className="mt-5 max-w-xl text-sm leading-6 text-stone-600">
        {t("description")}
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <GoalForm />
        <section>
          <h2 className="mb-4 text-lg font-semibold">{t("yourGoals")}</h2>
          <GoalsList goals={goals} activeGoalId={activeGoal?.id ?? null} />
        </section>
      </div>
    </AppShell>
  );
}
