import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { ReferenceList } from "@/components/reference-list";
import { getReferenceListContext } from "@/lib/reference-queries";

export default async function Library({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const context = await getReferenceListContext(locale, await searchParams);
  const t = await getTranslations("Library");
  return (
    <AppShell current="library" name={context.session.user.name}>
      <p className="eyebrow text-teal-800">{t("eyebrow")}</p>
      <h1 className="display mt-4 text-4xl sm:text-5xl">{t("title")}</h1>
      <p className="mt-5 max-w-xl text-sm leading-6 text-stone-600">
        {t("description")}
      </p>
      <form
        action={`/${locale}/library`}
        method="get"
        className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"
      >
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div>
            <label
              htmlFor="reference-search"
              className="mb-2 block text-sm font-semibold"
            >
              {t("searchLabel")}
            </label>
            <input
              id="reference-search"
              name="q"
              type="search"
              className="input"
              defaultValue={context.state?.query ?? ""}
              aria-describedby="reference-search-help"
            />
            <p
              id="reference-search-help"
              className="mt-2 text-xs text-stone-600"
            >
              {t("searchHelp")}
            </p>
          </div>
          <div>
            <label
              htmlFor="reference-type"
              className="mb-2 block text-sm font-semibold"
            >
              {t("typeLabel")}
            </label>
            <select
              id="reference-type"
              name="type"
              className="input"
              defaultValue={context.state?.type ?? "all"}
              disabled={Boolean(context.state?.positionId)}
            >
              <option value="all">{t("all")}</option>
              <option value="position">{t("positions")}</option>
              <option value="technique">{t("techniques")}</option>
            </select>
            {context.state?.positionId && (
              <input type="hidden" name="type" value="technique" />
            )}
          </div>
        </div>
        {context.state?.positionId && (
          <input
            type="hidden"
            name="position"
            value={context.state.positionId}
          />
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-xl bg-teal-800 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
          >
            {t("search")}
          </button>
          <a
            href={`/${locale}/library`}
            className="inline-flex min-h-11 items-center rounded-xl px-5 py-3 text-sm font-semibold text-teal-900 underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
          >
            {t("clearSearch")}
          </a>
        </div>
      </form>
      <ReferenceList state={context.state} results={context.results} />
    </AppShell>
  );
}
