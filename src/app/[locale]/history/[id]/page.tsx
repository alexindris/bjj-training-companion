import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getTrainingContext } from "@/lib/training-queries";
import { getOwnedClass } from "@/lib/training-store";
import { recordIdSchema } from "@/lib/training-validation";
import { AppShell } from "@/components/app-shell";
import { ClassDetail } from "@/components/class-detail";
import { Link } from "@/i18n/navigation";

export default async function HistoryDetail({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const { session } = await getTrainingContext(locale);
  if (!recordIdSchema.safeParse(id).success) notFound();
  const detail = await getOwnedClass(session.user.id, id);
  if (!detail) notFound();
  const t = await getTranslations("History");
  return (
    <AppShell current="history" name={session.user.name}>
      <Link
        href="/history"
        className="text-sm font-semibold text-teal-900 underline"
      >
        {t("back")}
      </Link>
      <h1 className="display mt-5 text-4xl">{t("detailTitle")}</h1>
      <ClassDetail detail={detail} />
    </AppShell>
  );
}
