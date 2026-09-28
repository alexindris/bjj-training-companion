import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { ReferenceDetailContent } from "@/components/reference-detail";
import { ReferenceNoteEditor } from "@/components/reference-note-editor";
import { Link } from "@/i18n/navigation";
import { getReferenceDetailContext } from "@/lib/reference-queries";
import { parseSearchState, type SearchState } from "@/lib/reference-validation";

function resultsHref(state: SearchState) {
  const query = new URLSearchParams();
  if (state.query) query.set("q", state.query);
  if (state.type !== "all") query.set("type", state.type);
  if (state.positionId) query.set("position", state.positionId);
  if (state.page) query.set("page", String(state.page));
  const suffix = query.toString();
  return suffix ? `/library?${suffix}` : "/library";
}

export default async function ReferenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; kind: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, kind, id } = await params;
  const context = await getReferenceDetailContext(locale, kind, id);
  const raw = await searchParams;
  const hasContext = ["q", "type", "page", "position"].some(
    (key) => key in raw,
  );
  const state = hasContext ? parseSearchState(raw) : null;
  const t = await getTranslations("Library");
  return (
    <AppShell current="library" name={context.session.user.name}>
      <Link
        href={state ? resultsHref(state) : "/library"}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-900 underline"
      >
        {t(state ? "backToResults" : "backToLibrary")}
      </Link>
      <ReferenceDetailContent detail={context.detail} />
      <div className="mt-6 max-w-3xl">
        <ReferenceNoteEditor
          key={`${locale}:${context.session.user.id}:${kind}:${id}`}
          ownerId={context.session.user.id}
          target={{
            kind: context.detail.reference.kind,
            referenceId: context.detail.reference.id,
          }}
          initialBody={context.note?.body ?? null}
        />
      </div>
    </AppShell>
  );
}
