"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  deleteReferenceNote,
  saveReferenceNote,
} from "@/app/reference-actions";
import { useRouter } from "@/i18n/navigation";
import { Button } from "./ui/button";

type ReferenceTarget = { kind: "position" | "technique"; referenceId: string };

function NoteFeedback({
  status,
  error,
}: {
  status?: "saved" | "deleted";
  error?: string;
}) {
  const t = useTranslations("ReferenceNote");
  return (
    <div aria-live="polite" className="mt-4 text-sm">
      {status && <p className="font-semibold text-teal-800">{t(status)}</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {t(
            `error.${error}` as
              | "error.invalidInput"
              | "error.unauthenticated"
              | "error.notFound"
              | "error.unavailable",
          )}
        </p>
      )}
    </div>
  );
}

export function ReferenceNoteEditor({
  target,
  ownerId,
  initialBody,
}: {
  target: ReferenceTarget;
  ownerId: string;
  initialBody: string | null;
}) {
  const t = useTranslations("ReferenceNote");
  const router = useRouter();
  const [savedBody, setSavedBody] = useState(initialBody);
  const [body, setBody] = useState(initialBody ?? "");
  const [editing, setEditing] = useState(initialBody === null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [bodyError, setBodyError] = useState<string>();
  const [status, setStatus] = useState<"saved" | "deleted">();

  const reset = () => {
    setBody(savedBody ?? "");
    setEditing(savedBody === null);
    setConfirming(false);
    setError(undefined);
    setBodyError(undefined);
    setStatus(undefined);
  };

  const save = () => {
    startTransition(async () => {
      setError(undefined);
      setBodyError(undefined);
      setStatus(undefined);
      try {
        const result = await saveReferenceNote({ ...target, body });
        if (result.error) {
          setError(result.error);
          setBodyError(result.fieldErrors?.body?.[0]);
          return;
        }
        setSavedBody(body);
        setEditing(false);
        setStatus("saved");
        router.refresh();
      } catch {
        setError("unavailable");
      }
    });
  };

  const remove = () => {
    startTransition(async () => {
      setError(undefined);
      setStatus(undefined);
      try {
        const result = await deleteReferenceNote(target);
        if (result.error) {
          setError(result.error);
          return;
        }
        setSavedBody(null);
        setBody("");
        setEditing(true);
        setConfirming(false);
        setStatus("deleted");
        router.refresh();
      } catch {
        setError("unavailable");
      }
    });
  };

  return (
    <section
      aria-labelledby={`private-note-${ownerId}`}
      className="min-w-0 rounded-2xl border border-teal-200 bg-teal-50 p-6 sm:p-8"
    >
      <h2 id={`private-note-${ownerId}`} className="text-xl font-semibold">
        {t("title")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">{t("private")}</p>
      {savedBody !== null && !editing && (
        <div className="mt-5">
          <p className="text-sm leading-6 break-all whitespace-pre-wrap">
            {savedBody}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={pending || confirming}
              onClick={() => {
                setStatus(undefined);
                setError(undefined);
                setEditing(true);
              }}
            >
              {t("edit")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending || confirming}
              onClick={() => {
                setStatus(undefined);
                setError(undefined);
                setConfirming(true);
              }}
            >
              {t("delete")}
            </Button>
          </div>
        </div>
      )}
      {editing && (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="mt-5"
        >
          <fieldset disabled={pending} aria-busy={pending}>
            <label
              htmlFor="reference-note-body"
              className="block text-sm font-semibold"
            >
              {t("body")}
            </label>
            <textarea
              id="reference-note-body"
              className="input mt-2 min-h-32 break-all"
              rows={6}
              value={body}
              aria-invalid={Boolean(bodyError)}
              aria-describedby="reference-note-help reference-note-error"
              onChange={(event) => {
                setBody(event.target.value);
                setBodyError(undefined);
                setError(undefined);
                setStatus(undefined);
              }}
            />
            <p
              id="reference-note-help"
              className="mt-2 text-xs leading-5 text-stone-600"
            >
              {t("limit")} {t("leaving")}
            </p>
            <p
              id="reference-note-error"
              role="alert"
              className="mt-2 text-sm text-red-700"
            >
              {bodyError === "requiredNote" && t("field.requiredNote")}
              {bodyError === "noteTooLong" && t("field.noteTooLong")}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="submit">{t(pending ? "saving" : "save")}</Button>
              {savedBody !== null && (
                <Button type="button" variant="ghost" onClick={reset}>
                  {t("cancel")}
                </Button>
              )}
            </div>
          </fieldset>
        </form>
      )}
      {confirming && !editing && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-white p-4">
          <p className="text-sm">{t("confirmQuestion")}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button type="button" disabled={pending} onClick={remove}>
              {t(pending ? "deleting" : "confirmDelete")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
      <NoteFeedback status={status} error={error} />
    </section>
  );
}
