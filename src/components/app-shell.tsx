import { getLocale, getTranslations } from "next-intl/server";
import { Compass, BookOpen, LogOut } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { Button } from "./ui/button";
import { signOut } from "@/app/actions";
import type { Locale } from "@/i18n/routing";

export async function AppShell({
  children,
  current,
  name,
}: {
  children: React.ReactNode;
  current: "today" | "library";
  name: string;
}) {
  const t = await getTranslations("App");
  const locale = (await getLocale()) as Locale;
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="flex flex-col border-b border-stone-200 bg-white lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-4 p-6 lg:p-8">
          <Brand />
          <span className="text-xs text-stone-500 lg:hidden">
            {t("foundation")}
          </span>
        </div>
        <nav
          aria-label={t("name")}
          className="flex gap-2 px-5 pb-5 lg:flex-col lg:pt-8"
        >
          {(
            [
              { key: "today", href: "/", icon: Compass },
              { key: "library", href: "/library", icon: BookOpen },
            ] as const
          ).map(({ key, href, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              aria-current={current === key ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${current === key ? "bg-[#eaf1eb] text-teal-900" : "text-stone-600 hover:bg-stone-100"}`}
            >
              <Icon size={18} aria-hidden="true" />
              {t(key)}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden p-7 text-xs leading-5 text-stone-500 lg:block">
          <p className="mb-2 font-medium text-teal-800">{t("foundation")}</p>
          <p>{t("footer")}</p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-6 py-4 sm:px-10">
          <p className="text-sm font-medium">{name}</p>
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher />
            <form action={signOut.bind(null, locale)}>
              <Button type="submit" variant="ghost" className="px-3">
                <LogOut size={16} aria-hidden="true" />
                <span>{t("signOut")}</span>
              </Button>
            </form>
          </div>
        </header>
        <main
          id="main"
          className="mx-auto max-w-6xl px-6 py-10 sm:px-10 sm:py-14"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
