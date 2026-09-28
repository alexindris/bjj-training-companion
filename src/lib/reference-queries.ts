import "server-only";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getSession } from "./session";
import { readOwnNote } from "./reference-notes";
import {
  getReferenceDetail,
  listReferences,
  referenceExists,
} from "./reference-store";
import {
  parseSearchState,
  referenceTargetSchema,
} from "./reference-validation";

type RawSearchParams = Record<string, string | string[] | undefined>;

async function verifiedSession(locale: string) {
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await getSession();
  if (!session) return redirect({ href: "/sign-in", locale });
  return session;
}

export async function getReferenceListContext(
  locale: string,
  rawSearchParams: RawSearchParams,
) {
  const session = await verifiedSession(locale);
  const state = parseSearchState(rawSearchParams);
  if (!state) return { session, state: null, results: null };
  if (state.positionId) {
    const exists = await referenceExists({
      kind: "position",
      referenceId: state.positionId,
    });
    if (!exists) return { session, state: null, results: null };
  }
  const results = await listReferences(state);
  return { session, state, results };
}

export async function getReferenceDetailContext(
  locale: string,
  kind: string,
  referenceId: string,
) {
  const session = await verifiedSession(locale);
  const target = referenceTargetSchema.safeParse({ kind, referenceId });
  if (!target.success) notFound();
  const detail = await getReferenceDetail(target.data);
  if (!detail) notFound();
  const note = await readOwnNote(session.user.id, target.data);
  return { session, detail, note };
}
