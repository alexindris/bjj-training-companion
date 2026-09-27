import { getTranslations } from "next-intl/server";
import { getTrainingContext } from "@/lib/training-queries";
import { listOwnedHistory } from "@/lib/training-store";
import { parseHistoryPage } from "@/lib/training-validation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function History({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { locale } = await params;
  const { session } = await getTrainingContext(locale);
  const input = await searchParams;
  const page = parseHistoryPage(input.page ?? 0);
  const { classes, hasMore } = await listOwnedHistory(session.user.id, page);
  const t = await getTranslations("History");
  const l = await getTranslations("Log");
  return (
    <AppShell current="history" name={session.user.name}>
      <p className="eyebrow text-teal-800">{t("eyebrow")}</p>
      <h1 className="display mt-4 text-4xl sm:text-5xl">{t("title")}</h1>
      <p className="mt-5 text-sm leading-6 text-stone-600">
        {t("description")}
      </p>
      <div className="mt-8 space-y-4">
        {classes.length ? (
          classes.map((record) => (
            <article
              key={record.id}
              className="rounded-2xl border border-stone-200 bg-white p-6"
            >
              <p className="text-xs font-semibold text-teal-800">
                {record.date} · {l(record.mode)}
              </p>
              <h2 className="mt-3 text-lg font-semibold break-words whitespace-pre-wrap">
                {record.technique}
              </h2>
              <Link
                href={`/history/${record.id}`}
                className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-teal-900 underline"
              >
                {t("details")}
              </Link>
            </article>
          ))
        ) : (
          <p className="rounded-2xl border border-stone-200 bg-white p-6 text-sm">
            {t("empty")}
          </p>
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {page > 0 && (
          <Button asChild variant="outline">
            <Link href={{ pathname: "/history", query: { page: page - 1 } }}>
              {t("newer")}
            </Link>
          </Button>
        )}
        {hasMore && (
          <Button asChild variant="outline">
            <Link href={{ pathname: "/history", query: { page: page + 1 } }}>
              {t("older")}
            </Link>
          </Button>
        )}
        <Button asChild>
          <Link href="/log">{t("log")}</Link>
        </Button>
      </div>
    </AppShell>
  );
}
