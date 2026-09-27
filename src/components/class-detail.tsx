import { getTranslations } from "next-intl/server";
import type { TrainingClassDetail } from "@/lib/training-store";

export async function ClassDetail({ detail }: { detail: TrainingClassDetail }) {
  const t = await getTranslations("Log");
  const h = await getTranslations("History");
  return (
    <article className="mt-8 max-w-3xl space-y-7 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
      <dl className="grid grid-cols-2 gap-5 text-sm">
        <div>
          <dt className="text-stone-500">{t("date")}</dt>
          <dd className="mt-1 font-semibold">{detail.class.date}</dd>
        </div>
        <div>
          <dt className="text-stone-500">{t("mode")}</dt>
          <dd className="mt-1 font-semibold">{t(detail.class.mode)}</dd>
        </div>
      </dl>
      <section>
        <h2 className="text-sm font-semibold">{t("technique")}</h2>
        <p className="mt-3 text-sm leading-6 break-words whitespace-pre-wrap">
          {detail.class.technique}
        </p>
      </section>
      {detail.observation && detail.goal ? (
        <section className="space-y-5 rounded-xl bg-stone-50 p-5">
          <div>
            <h2 className="text-sm font-semibold">{t("goal")}</h2>
            <p className="mt-2 break-words whitespace-pre-wrap">
              {detail.goal.title}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">{t("outcome")}</h3>
            <p className="mt-2 text-sm">{t(detail.observation.outcome)}</p>
          </div>
          {detail.observation.outcome === "tried" && (
            <dl className="grid gap-4 sm:grid-cols-3">
              {(["opportunities", "attempts", "successes"] as const).map(
                (field) => (
                  <div key={field}>
                    <dt className="text-xs text-stone-500">{t(field)}</dt>
                    <dd className="mt-1 text-sm">
                      {detail.observation?.[field] ?? h("unknown")}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          )}
          {(["obstacle", "nextCue"] as const).map((field) => (
            <div key={field}>
              <h3 className="text-sm font-semibold">{t(field)}</h3>
              <p className="mt-2 text-sm leading-6 break-words whitespace-pre-wrap">
                {detail.observation?.[field] || h("notEntered")}
              </p>
            </div>
          ))}
        </section>
      ) : (
        <p className="text-sm text-stone-500">{t("withoutGoal")}</p>
      )}
      <p className="text-xs text-stone-500">{h("readOnly")}</p>
    </article>
  );
}
