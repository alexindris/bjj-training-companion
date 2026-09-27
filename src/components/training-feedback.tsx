"use client";
import { useTranslations } from "next-intl";

export function TrainingError({ code }: { code?: string }) {
  const t = useTranslations("Training");
  if (!code) return null;
  return (
    <p role="alert" className="text-sm text-red-800">
      {t(t.has(code) ? code : "unavailable")}
    </p>
  );
}

export function FieldErrors({ errors }: { errors?: string[] }) {
  const t = useTranslations("Validation");
  if (!errors?.length) return null;
  return (
    <div role="alert" className="mt-2 text-sm text-red-800">
      {errors.map((code, index) => (
        <p key={`${code}-${index}`}>{t(t.has(code) ? code : "invalidInput")}</p>
      ))}
    </div>
  );
}
