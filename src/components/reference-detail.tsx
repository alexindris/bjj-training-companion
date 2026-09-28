import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { ReferenceDetail as Detail } from "@/lib/reference-store";
import { formatStartTime, videoHref } from "@/lib/reference-validation";

function referenceHref(kind: string, id: string) {
  return `/library/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;
}

export async function ReferenceDetailContent({ detail }: { detail: Detail }) {
  const t = await getTranslations("Library");
  const { reference, parent, techniques, techniquesHasMore, videos } = detail;
  return (
    <div className="mt-7 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <article className="min-w-0 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        <p className="eyebrow text-teal-800">{t(reference.kind)}</p>
        <div lang="en" className="min-w-0">
          <h1 className="display mt-4 text-4xl break-words sm:text-5xl">
            {reference.title}
          </h1>
          <p className="mt-5 text-sm leading-7 break-words text-stone-700">
            {reference.description}
          </p>
        </div>
        <h2 className="mt-8 text-xs font-semibold tracking-widest text-stone-500 uppercase">
          {t("provenance")}
        </h2>
        <p lang="en" className="mt-2 text-sm break-words text-stone-600">
          {reference.provenance}
        </p>
      </article>
      <aside className="min-w-0 space-y-6">
        {parent && (
          <section className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="text-lg font-semibold">{t("parentPosition")}</h2>
            <Link
              href={referenceHref(parent.kind, parent.id)}
              lang="en"
              className="mt-3 inline-flex min-h-11 items-center font-semibold break-words text-teal-900 underline"
            >
              {parent.title}
            </Link>
          </section>
        )}
        {reference.kind === "position" && (
          <section className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="text-lg font-semibold">{t("relatedTechniques")}</h2>
            {techniques.length ? (
              <ul className="mt-3 space-y-2">
                {techniques.map((technique) => (
                  <li key={technique.id}>
                    <Link
                      href={referenceHref(technique.kind, technique.id)}
                      lang="en"
                      className="inline-flex min-h-11 items-center text-sm font-semibold break-words text-teal-900 underline"
                    >
                      {technique.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-stone-600">{t("noTechniques")}</p>
            )}
            {techniquesHasMore && (
              <Link
                href={`/library?type=technique&position=${encodeURIComponent(reference.id)}`}
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-teal-900 underline"
              >
                {t("viewAllTechniques")}
              </Link>
            )}
          </section>
        )}
        {reference.kind === "technique" && (
          <section className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="text-lg font-semibold">{t("videos")}</h2>
            {videos.length ? (
              <ul className="mt-4 space-y-5">
                {videos.map((video) => {
                  const href = videoHref(video.url, video.startSeconds);
                  const start = formatStartTime(video.startSeconds);
                  return (
                    <li
                      key={video.id}
                      className="min-w-0 border-t border-stone-200 pt-4 first:border-0 first:pt-0"
                    >
                      <div
                        lang="en"
                        className="min-w-0 text-sm leading-6 break-words"
                      >
                        <p className="font-semibold">{video.label}</p>
                        <p>{video.momentLabel}</p>
                        <p>
                          {video.sourceName} · {video.sourceTitle}
                        </p>
                        <p className="text-stone-600">{video.provenance}</p>
                      </div>
                      <p className="mt-1 text-xs text-stone-600">
                        {t("reviewedOn")}:{" "}
                        <span lang="en">{video.reviewedOn}</span>
                      </p>
                      {href && start ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold break-words text-teal-900 underline"
                        >
                          {t("watchAt", { time: start })} {t("newTab")}
                        </a>
                      ) : (
                        <p className="mt-2 text-sm text-stone-600">
                          {t("videoUnavailable")}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-stone-600">{t("noVideos")}</p>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
