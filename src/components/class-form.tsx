"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveClass } from "@/app/training-actions";
import { Link } from "@/i18n/navigation";
import {
  createFreshDraft,
  recoverDraft,
  persistDraft,
  removeDraft,
  settleDraftSave,
  changeDraftGoal,
  changeDraftOutcome,
  toSaveInput,
  type ClassDraft,
} from "@/lib/class-draft";
import { Button } from "./ui/button";
import { TrainingError } from "./training-feedback";
import { ClassBasics, GoalSelector, ObservationFields } from "./class-fields";

type Props = {
  userId: string;
  mode: ClassDraft["mode"];
  activeGoalId: string | null;
  goals: { id: string; title: string }[];
};
type Receipt = { classId: string; alreadySaved?: boolean };

function DraftStatus({
  pending,
  error,
  receipt,
}: {
  pending: boolean;
  error?: string;
  receipt?: Receipt;
}) {
  const t = useTranslations("Log");
  const status = pending
    ? "saving"
    : error
      ? "failed"
      : receipt
        ? receipt.alreadySaved
          ? "alreadySaved"
          : "saved"
        : "draft";
  return (
    <p role="status" className="text-sm font-semibold text-teal-800">
      {t(status)}
    </p>
  );
}

export function ClassForm({ userId, mode, activeGoalId, goals }: Props) {
  const t = useTranslations("Log");
  const initialDefaults = useRef({ mode, activeGoalId });
  const [draft, setDraft] = useState<ClassDraft | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [storageWarning, setStorageWarning] = useState(false);
  const [recoveryError, setRecoveryError] = useState(false);
  const [receipt, setReceipt] = useState<Receipt>();
  useEffect(() => {
    let current = true;
    Promise.resolve().then(() => {
      if (!current) return;
      try {
        const recovered = recoverDraft(window.localStorage, userId);
        setRecoveryError(recovered.error === "invalid");
        setStorageWarning(recovered.error === "unavailable");
        setDraft(
          recovered.draft ??
            createFreshDraft(
              initialDefaults.current.mode,
              initialDefaults.current.activeGoalId,
            ),
        );
      } catch {
        setStorageWarning(true);
        setDraft(
          createFreshDraft(
            initialDefaults.current.mode,
            initialDefaults.current.activeGoalId,
          ),
        );
      }
    });
    return () => {
      current = false;
    };
  }, [userId]);
  useEffect(() => {
    if (!draft || (receipt && !receipt.alreadySaved)) return;
    try {
      if (!persistDraft(window.localStorage, userId, draft))
        Promise.resolve().then(() => setStorageWarning(true));
    } catch {
      Promise.resolve().then(() => setStorageWarning(true));
    }
  }, [draft, userId, receipt]);
  const update = (change: Partial<ClassDraft>) => {
    setDraft((value) => value && { ...value, ...change });
    setError(undefined);
    setErrors({});
  };
  const newLog = () => {
    try {
      setStorageWarning(!removeDraft(window.localStorage, userId));
    } catch {
      setStorageWarning(true);
    }
    setDraft(createFreshDraft(mode, activeGoalId));
    setReceipt(undefined);
    setError(undefined);
    setErrors({});
    setRecoveryError(false);
  };
  const submit = () => {
    if (!draft) return;
    startTransition(async () => {
      setError(undefined);
      setErrors({});
      setReceipt(undefined);
      try {
        const result = await saveClass(toSaveInput(draft));
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
        if (result.classId) {
          setReceipt({
            classId: result.classId,
            alreadySaved: result.alreadySaved,
          });
          try {
            const settled = settleDraftSave(
              window.localStorage,
              userId,
              draft,
              { alreadySaved: Boolean(result.alreadySaved) },
            );
            setDraft(settled.draft);
            setStorageWarning(!settled.storageAvailable);
          } catch {
            setStorageWarning(true);
            if (!result.alreadySaved) setDraft(null);
          }
        }
      } catch {
        setError("unavailable");
      }
    });
  };
  if (!draft && !receipt) return <p role="status">{t("recovering")}</p>;
  return (
    <div className="max-w-3xl space-y-5">
      <DraftStatus pending={pending} error={error} receipt={receipt} />
      {storageWarning && (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950"
        >
          {t("storageWarning")}
        </p>
      )}
      {recoveryError && (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950"
        >
          {t("invalidDraft")}
        </p>
      )}
      {receipt && (
        <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-5">
          <p className="text-sm">
            {t(
              receipt.alreadySaved
                ? "duplicateExplanation"
                : "savedExplanation",
            )}
          </p>
          <Link
            className="font-semibold text-teal-900 underline"
            href={`/history/${receipt.classId}`}
          >
            {t("viewSaved")}
          </Link>
          <div>
            <Button type="button" variant="outline" onClick={newLog}>
              {t("newLog")}
            </Button>
          </div>
        </div>
      )}
      {draft && (!receipt || receipt.alreadySaved) && (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"
        >
          <fieldset
            disabled={pending}
            aria-busy={pending}
            className="space-y-6"
          >
            <ClassBasics draft={draft} update={update} errors={errors} />
            <GoalSelector
              goals={goals}
              value={draft.goalId}
              onChange={(goalId) => {
                setDraft(changeDraftGoal(draft, goalId));
                setErrors({});
              }}
              errors={errors.goalId}
            />
            {draft.goalId && (
              <ObservationFields
                draft={draft}
                update={update}
                errors={errors}
                onOutcome={(outcome) => {
                  setDraft(changeDraftOutcome(draft, outcome));
                  setErrors({});
                }}
              />
            )}
            <TrainingError code={error} />
            <div className="flex flex-wrap gap-3">
              <Button type="submit">{t(pending ? "saving" : "save")}</Button>
              <Button type="button" variant="ghost" onClick={newLog}>
                {t("discard")}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      <p className="text-xs leading-5 text-stone-500">{t("draftLimit")}</p>
    </div>
  );
}
