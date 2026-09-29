"use client";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe2 } from "lucide-react";
import { changeLocale } from "@/app/actions";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("App");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <Globe2 size={16} aria-hidden="true" />
        <label className="sr-only" htmlFor="ui-language">
          {t("language")}
        </label>
        <select
          id="ui-language"
          value={locale}
          disabled={pending}
          aria-busy={pending}
          className="min-h-11 rounded-lg bg-transparent px-2 focus-visible:outline-2 focus-visible:outline-teal-700"
          onChange={(event) => {
            const next = event.target.value as Locale;
            startTransition(async () => {
              setFailed(false);
              const result = await changeLocale(next);
              if (!result.success) {
                setFailed(true);
                return;
              }
              router.replace(`${pathname}${window.location.search}`, {
                locale: next,
              });
              router.refresh();
            });
          }}
        >
          <option value="en" lang="en">
            English
          </option>
          <option value="es" lang="es">
            Español
          </option>
        </select>
      </div>
      {failed && (
        <p role="alert" className="text-sm text-red-700">
          {t("saveFailed")}
        </p>
      )}
    </div>
  );
}
