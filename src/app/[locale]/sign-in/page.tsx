import { getTranslations } from "next-intl/server";
import { ArrowUpRight, CircleCheck } from "lucide-react";
import { getSession, getOwnProfile } from "@/lib/session";
import { redirect } from "@/i18n/navigation";
import { Brand } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SignInForm } from "@/components/sign-in-form";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await getSession();
  if (session) {
    const profile = await getOwnProfile(session.user.id);
    redirect({ href: "/", locale: profile?.locale === "es" ? "es" : "en" });
  }
  const t = await getTranslations("Auth");
  const app = await getTranslations("App");
  return (
    <main id="main" className="flex min-h-dvh flex-col lg:grid lg:grid-cols-2">
      <section className="mat-pattern relative order-2 flex flex-col bg-[#183f3e] px-7 py-9 text-white sm:px-14 lg:order-1 lg:min-h-dvh lg:px-16 lg:py-12">
        <Brand />
        <div className="my-14 max-w-xl lg:my-auto lg:py-20">
          <p className="eyebrow mb-6 text-[#b9d8cb]">{t("eyebrow")}</p>
          <h1 className="display text-5xl leading-[1.08] whitespace-pre-line sm:text-6xl xl:text-7xl">
            {t("headline")}
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-[#d3e3db]">
            {t("intro")}
          </p>
          <ul className="mt-9 space-y-4 text-sm text-[#d3e3db]">
            {(["point1", "point2", "point3"] as const).map((key) => (
              <li key={key} className="flex gap-3">
                <CircleCheck size={18} aria-hidden="true" />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden text-xs text-[#b9d8cb] lg:block">
          {app("footer")}
        </p>
        <ArrowUpRight
          className="absolute right-12 bottom-12 hidden text-[#b9d8cb] lg:block"
          size={28}
          aria-hidden="true"
        />
      </section>
      <section className="order-1 flex flex-col px-7 py-7 sm:px-14 lg:order-2 lg:px-16 lg:py-10">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="mx-auto my-10 w-full max-w-sm lg:my-auto lg:py-12">
          <h2 className="display text-4xl">{t("title")}</h2>
          <p className="mt-3 text-sm text-stone-600">{t("subtitle")}</p>
          <SignInForm />
          <p className="mt-5 text-xs leading-5 text-stone-600">
            {t("privacy")}
          </p>
          {process.env.NODE_ENV !== "production" && (
            <aside className="mt-8 rounded-xl border border-stone-200 bg-white p-4 text-xs leading-5">
              <p className="mb-2 font-semibold">{t("devTitle")}</p>
              <p>sam@example.test · English</p>
              <p>jamie@example.test · Español</p>
              <p className="mt-2 text-stone-600">{t("devNote")}</p>
            </aside>
          )}
        </div>
      </section>
    </main>
  );
}
