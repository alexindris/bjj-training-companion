import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function ReferenceNotFound() {
  const t = await getTranslations("Library");
  return (
    <main id="main" className="mx-auto max-w-xl px-6 py-16">
      <h1 className="display text-4xl">{t("notFound")}</h1>
      <p className="mt-4 text-sm">{t("notFoundDescription")}</p>
      <Link
        href="/library"
        className="mt-6 inline-flex min-h-11 items-center font-semibold text-teal-900 underline"
      >
        {t("backToLibrary")}
      </Link>
    </main>
  );
}
