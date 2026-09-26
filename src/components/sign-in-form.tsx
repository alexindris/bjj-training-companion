"use client";
import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { signIn } from "@/app/actions";
import { Button } from "./ui/button";

export function SignInForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [state, action, pending] = useActionState(signIn, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form
      action={action}
      noValidate
      className="mt-8 space-y-5"
      aria-busy={pending}
    >
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="email">
          {t("email")}
        </label>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          aria-describedby={state.error ? "sign-in-error" : undefined}
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="password">
          {t("password")}
        </label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          minLength={12}
          aria-describedby={state.error ? "sign-in-error" : undefined}
        />
      </div>
      {state.error && (
        <p id="sign-in-error" role="alert" className="text-sm text-red-700">
          {t(state.error)}
        </p>
      )}
      <Button className="w-full" type="submit" disabled={pending}>
        {t(pending ? "submitting" : "submit")}
        <ArrowRight size={17} aria-hidden="true" />
      </Button>
    </form>
  );
}
