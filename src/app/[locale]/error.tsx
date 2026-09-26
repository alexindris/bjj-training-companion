"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations("Error");
  return (
    <main id="main" className="mx-auto max-w-xl px-6 py-20">
      <h1 className="display text-3xl">{t("title")}</h1>
      <p className="my-6 text-stone-600">{t("description")}</p>
      <Button onClick={reset}>{t("retry")}</Button>
    </main>
  );
}
