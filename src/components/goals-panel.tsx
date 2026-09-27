"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createGoal, selectFocus } from "@/app/training-actions";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./ui/button";
import { FieldErrors, TrainingError } from "./training-feedback";

type GoalSummary = { id: string; title: string; notes: string | null };

export function FocusButton({
  goalId,
  clear = false,
}: {
  goalId: string | null;
  clear?: boolean;
}) {
  const t = useTranslations("Goals");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await selectFocus(goalId);
              setError(result.error);
              if (!result.error) router.refresh();
            } catch {
              setError("unavailable");
            }
          })
        }
      >
        {t(pending ? "pending" : clear ? "clear" : "activate")}
      </Button>
      <TrainingError code={error} />
    </div>
  );
}

export function GoalForm() {
  const t = useTranslations("Goals");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [created, setCreated] = useState(false);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setCreated(false);
          try {
            const result = await createGoal({ title, notes });
            setError(result.error);
            setFieldErrors(result.fieldErrors ?? {});
            if (!result.error) {
              setTitle("");
              setNotes("");
              setCreated(true);
              router.refresh();
            }
          } catch {
            setError("unavailable");
          }
        });
      }}
      className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"
    >
      <h2 className="text-lg font-semibold">{t("create")}</h2>
      <fieldset disabled={pending} className="mt-5 space-y-5">
        <div>
          <label
            htmlFor="goal-title"
            className="mb-2 block text-sm font-medium"
          >
            {t("goalTitle")}
          </label>
          <input
            id="goal-title"
            name="title"
            className="input"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            aria-invalid={Boolean(fieldErrors.title)}
          />
          <p className="mt-1 text-xs text-stone-500">{t("titleLimit")}</p>
          <FieldErrors errors={fieldErrors.title} />
        </div>
        <div>
          <label
            htmlFor="goal-notes"
            className="mb-2 block text-sm font-medium"
          >
            {t("notes")}
          </label>
          <textarea
            id="goal-notes"
            name="notes"
            rows={3}
            className="input"
            value={notes}
            maxLength={5000}
            onChange={(event) => setNotes(event.target.value)}
            aria-invalid={Boolean(fieldErrors.notes)}
          />
          <p className="mt-1 text-xs text-stone-500">{t("notesLimit")}</p>
          <FieldErrors errors={fieldErrors.notes} />
        </div>
        <Button type="submit">{t(pending ? "pending" : "submit")}</Button>
      </fieldset>
      <div className="mt-4" aria-live="polite">
        <TrainingError code={error} />
        {created && <p className="text-sm text-teal-800">{t("created")}</p>}
      </div>
    </form>
  );
}

export function GoalsList({
  goals,
  activeGoalId,
}: {
  goals: GoalSummary[];
  activeGoalId: string | null;
}) {
  const t = useTranslations("Goals");
  if (!goals.length)
    return (
      <p className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
        {t("empty")}
      </p>
    );
  return (
    <div className="space-y-4">
      {goals.map((goal) => (
        <article
          key={goal.id}
          className="rounded-2xl border border-stone-200 bg-white p-6"
        >
          <h2 className="text-lg font-semibold break-words whitespace-pre-wrap">
            {goal.title}
          </h2>
          {goal.notes !== null && (
            <p className="mt-3 text-sm leading-6 break-words whitespace-pre-wrap text-stone-600">
              {goal.notes}
            </p>
          )}
          <div className="mt-5">
            {activeGoalId === goal.id ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-teal-800">
                  {t("active")}
                </p>
                <FocusButton goalId={null} clear />
              </div>
            ) : (
              <FocusButton goalId={goal.id} />
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
