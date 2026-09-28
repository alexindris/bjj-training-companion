import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { SearchState } from "@/lib/reference-validation";
import type { ReferenceSummary } from "@/lib/reference-store";
import { Button } from "./ui/button";

type Results = {
  items: ReferenceSummary[];
  hasMore: boolean;
};

function listQuery(state: SearchState, page = state.page) {
  const query = new URLSearchParams();
  if (state.query) query.set("q", state.query);
  if (state.type !== "all") query.set("type", state.type);
  if (state.positionId) query.set("position", state.positionId);
  if (page) query.set("page", String(page));
  return query.toString();
}

function detailHref(item: ReferenceSummary, state: SearchState) {
  const context = listQuery(state);
  const path = `/library/${encodeURIComponent(item.kind)}/${encodeURIComponent(item.id)}`;
  return context ? `${path}?${context}` : path;
}

export async function ReferenceList({
  state,
  results,
}: {
  state: SearchState | null;
  results: Results | null;
}) {
  const t = await getTranslations("Library");
  if (!state || !results) {
    return (
      <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold">{t("invalidSearch")}</h2>
        <p className="mt-2 text-sm">{t("invalidSearchHelp")}</p>
        <Button asChild className="mt-5">
          <Link href="/library">{t("reset")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <section aria-labelledby="reference-results" className="mt-9">
      <h2 id="reference-results" className="text-xl font-semibold">
        {t("results")}
      </h2>
      {state.positionId && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <p>{t("positionFilter")}</p>
          <Link
            href="/library"
            className="font-semibold text-teal-900 underline"
          >
            {t("clearPositionFilter")}
          </Link>
        </div>
      )}
      {results.items.length ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {results.items.map((item) => (
            <article
              key={`${item.kind}-${item.id}`}
              className="min-w-0 rounded-2xl border border-stone-200 bg-white p-6"
            >
              <p className="eyebrow text-teal-800">{t(item.kind)}</p>
              <div lang="en" className="mt-3 min-w-0">
                <h3 className="display text-2xl break-words">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 break-words text-stone-600">
                  {item.description}
                </p>
              </div>
              <Link
                href={detailHref(item, state)}
                className="mt-4 inline-flex min-h-11 items-center font-semibold text-teal-900 underline"
              >
                {t("viewReference")}
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-6">
          <p className="text-sm">
            {t(
              state.page
                ? "emptyPage"
                : state.query || state.type !== "all" || state.positionId
                  ? "noResults"
                  : "emptyCorpus",
            )}
          </p>
          <Link
            href="/library"
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-teal-900 underline"
          >
            {t("reset")}
          </Link>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {state.page > 0 && (
          <Button asChild variant="outline">
            <Link href={`/library?${listQuery(state, state.page - 1)}`}>
              {t("previous")}
            </Link>
          </Button>
        )}
        {results.hasMore && state.page < 10_000 && (
          <Button asChild variant="outline">
            <Link href={`/library?${listQuery(state, state.page + 1)}`}>
              {t("next")}
            </Link>
          </Button>
        )}
      </div>
      {state.page === 10_000 && results.hasMore && (
        <p className="mt-3 text-sm text-stone-600">{t("refineSearch")}</p>
      )}
    </section>
  );
}
