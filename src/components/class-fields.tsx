"use client";
import { useTranslations } from "next-intl";
import type { ClassDraft } from "@/lib/class-draft";
import { FieldErrors } from "./training-feedback";

type FieldsProps = {
  draft: ClassDraft;
  update: (change: Partial<ClassDraft>) => void;
  errors: Record<string, string[]>;
};
type GoalChoice = { id: string; title: string };

export function ClassBasics({ draft, update, errors }: FieldsProps) {
  const t = useTranslations("Log");
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            className="mb-2 block text-sm font-medium"
            htmlFor="class-date"
          >
            {t("date")}
          </label>
          <input
            id="class-date"
            name="date"
            type="date"
            className="input"
            value={draft.date}
            onChange={(event) => update({ date: event.target.value })}
            aria-invalid={Boolean(errors.date)}
          />
          <FieldErrors errors={errors.date} />
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-medium"
            htmlFor="class-mode"
          >
            {t("mode")}
          </label>
          <select
            id="class-mode"
            name="mode"
            className="input"
            value={draft.mode}
            onChange={(event) =>
              update({ mode: event.target.value as ClassDraft["mode"] })
            }
          >
            <option value="gi">{t("gi")}</option>
            <option value="no-gi">{t("no-gi")}</option>
          </select>
          <FieldErrors errors={errors.mode} />
        </div>
      </div>
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          htmlFor="class-technique"
        >
          {t("technique")}
        </label>
        <textarea
          id="class-technique"
          name="technique"
          className="input"
          rows={3}
          value={draft.technique}
          maxLength={2000}
          onChange={(event) => update({ technique: event.target.value })}
          aria-invalid={Boolean(errors.technique)}
        />
        <p className="mt-1 text-xs text-stone-500">{t("techniqueLimit")}</p>
        <FieldErrors errors={errors.technique} />
      </div>
    </div>
  );
}

export function GoalSelector({
  goals,
  value,
  onChange,
  errors,
}: {
  goals: GoalChoice[];
  value: string;
  onChange: (goalId: string) => void;
  errors?: string[];
}) {
  const t = useTranslations("Log");
  const missing = value !== "" && !goals.some((goal) => goal.id === value);
  return (
    <div>
      <label className="mb-2 block text-sm font-medium" htmlFor="class-goal">
        {t("goal")}
      </label>
      <select
        id="class-goal"
        name="goalId"
        value={value}
        className="input"
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{t("withoutGoal")}</option>
        {missing && <option value={value}>{t("unavailableGoal")}</option>}
        {goals.map((goal) => (
          <option key={goal.id} value={goal.id}>
            {goal.title}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs leading-5 text-stone-500">{t("goalReset")}</p>
      <FieldErrors errors={errors} />
    </div>
  );
}

export function ObservationFields({
  draft,
  update,
  errors,
  onOutcome,
}: FieldsProps & { onOutcome: (outcome: ClassDraft["outcome"]) => void }) {
  const t = useTranslations("Log");
  return (
    <div className="space-y-5 rounded-xl bg-stone-50 p-5">
      <h2 className="text-lg font-semibold">{t("observation")}</h2>
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          htmlFor="goal-outcome"
        >
          {t("outcome")}
        </label>
        <select
          id="goal-outcome"
          name="outcome"
          value={draft.outcome}
          className="input"
          onChange={(event) =>
            onOutcome(event.target.value as ClassDraft["outcome"])
          }
          aria-invalid={Boolean(errors.outcome)}
        >
          <option value="">{t("chooseOutcome")}</option>
          <option value="no_opportunity">{t("no_opportunity")}</option>
          <option value="tried">{t("tried")}</option>
          <option value="worked_on_something_else">
            {t("worked_on_something_else")}
          </option>
        </select>
        <FieldErrors errors={errors.outcome} />
      </div>
      {draft.outcome === "tried" && (
        <div>
          <p className="mb-3 text-xs leading-5 text-stone-500">
            {t("countsHelp")}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {(["opportunities", "attempts", "successes"] as const).map(
              (field) => (
                <div key={field}>
                  <label
                    className="mb-2 block text-sm font-medium"
                    htmlFor={`count-${field}`}
                  >
                    {t(field)}
                  </label>
                  <input
                    id={`count-${field}`}
                    name={field}
                    inputMode="numeric"
                    type="text"
                    className="input"
                    value={draft[field]}
                    onChange={(event) =>
                      update({ [field]: event.target.value })
                    }
                    aria-invalid={Boolean(errors[field])}
                  />
                  <FieldErrors errors={errors[field]} />
                </div>
              ),
            )}
          </div>
        </div>
      )}
      {(["obstacle", "nextCue"] as const).map((field) => (
        <div key={field}>
          <label
            className="mb-2 block text-sm font-medium"
            htmlFor={`reflection-${field}`}
          >
            {t(field)}
          </label>
          <textarea
            id={`reflection-${field}`}
            name={field}
            className="input"
            rows={2}
            value={draft[field]}
            maxLength={5000}
            onChange={(event) => update({ [field]: event.target.value })}
            aria-invalid={Boolean(errors[field])}
          />
          <p className="mt-1 text-xs text-stone-500">{t("reflectionLimit")}</p>
          <FieldErrors errors={errors[field]} />
        </div>
      ))}
    </div>
  );
}
