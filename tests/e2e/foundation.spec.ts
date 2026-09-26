import { test, expect, type Page } from "@playwright/test";
import { Pool } from "pg";
import { assertLocalSeed } from "../../scripts/seed-guard";

const password = assertLocalSeed(process.env);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function login(page: Page, email: string) {
  await page.goto("/en/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test.beforeEach(async () => {
  await pool.query(
    "update profiles set locale = case when u.email = 'jamie@example.test' then 'es' else 'en' end from users u where profiles.user_id = u.id and u.email in ('sam@example.test', 'jamie@example.test')",
  );
});
test.afterAll(async () => {
  await pool.query(
    "update profiles set locale = case when u.email = 'jamie@example.test' then 'es' else 'en' end from users u where profiles.user_id = u.id and u.email in ('sam@example.test', 'jamie@example.test')",
  );
  await pool.end();
});

test("protected routes reject anonymous and forged sessions", async ({
  page,
  context,
}) => {
  await page.goto("/en");
  await expect(page).toHaveURL(/\/en\/sign-in$/);
  await expect(
    page.getByText("Local development accounts", { exact: true }),
  ).toHaveCount(process.env.E2E_PRODUCTION === "true" ? 0 : 1);
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "forged-token",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/es/library");
  await expect(page).toHaveURL(/\/es\/sign-in$/);
  await expect(
    page.getByRole("heading", { name: "Te damos la bienvenida" }),
  ).toBeVisible();
});

test("localized validation and incorrect credentials", async ({ page }) => {
  await page.goto("/es/sign-in");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page.locator("#sign-in-error")).toContainText(
    "Introduce un correo válido",
  );
  await page.getByLabel("Correo electrónico").fill("sam@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("incorrect-test-password");
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page.locator("#sign-in-error")).toContainText(
    "El correo o la contraseña no coinciden",
  );
});

test("real accounts retain independent languages and the same English references", async ({
  page,
  browser,
}) => {
  await login(page, "sam@example.test");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByText("Good to see you, Sam Demo.")).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-dashboard.png",
    fullPage: true,
  });
  await page.getByLabel("Interface language").selectOption("es");
  await expect(page).toHaveURL(/\/es$/);
  await expect(page.getByText("Qué bueno verte, Sam Demo.")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page
    .getByRole("link", { name: "Biblioteca de referencia", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Closed guard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Conoce tu posición." }),
  ).toBeVisible();
  const englishCopy = await page
    .locator('article [lang="en"]')
    .allTextContents();
  await page.getByLabel("Idioma de la interfaz").selectOption("en");
  await expect(page).toHaveURL(/\/en\/library$/);
  expect(await page.locator('article [lang="en"]').allTextContents()).toEqual(
    englishCopy,
  );
  await page.getByLabel("Interface language").selectOption("es");
  await expect(page).toHaveURL(/\/es\/library$/);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/\/es\/sign-in$/);
  await page.goto("/en/library");
  await expect(page).toHaveURL(/\/en\/sign-in$/);
  expect(
    await page.request.get("/api/auth/get-session").then((r) => r.json()),
  ).toBeNull();

  const second = await browser.newContext();
  const jamie = await second.newPage();
  await login(jamie, "jamie@example.test");
  await expect(jamie).toHaveURL(/\/es$/);
  await expect(jamie.getByText("Qué bueno verte, Jamie Demo.")).toBeVisible();
  await jamie.getByLabel("Idioma de la interfaz").selectOption("en");
  await expect(jamie).toHaveURL(/\/en$/);
  const result = await pool.query(
    "select u.email, p.locale from profiles p join users u on u.id=p.user_id where u.email in ('sam@example.test','jamie@example.test') order by u.email",
  );
  expect(result.rows).toEqual([
    { email: "jamie@example.test", locale: "en" },
    { email: "sam@example.test", locale: "es" },
  ]);
  await jamie.getByLabel("Interface language").selectOption("es");
  await expect(jamie).toHaveURL(/\/es$/);
  await second.close();

  const fresh = await browser.newContext();
  const sam = await fresh.newPage();
  await login(sam, "sam@example.test");
  await expect(sam).toHaveURL(/\/es$/);
  await expect(sam.getByText("Qué bueno verte, Sam Demo.")).toBeVisible();
  await fresh.close();

  await login(page, "jamie@example.test");
  await expect(page).toHaveURL(/\/es$/);
  await expect(page.getByText("Qué bueno verte, Jamie Demo.")).toBeVisible();
});

test("mobile sign-in and dashboard fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/sign-in");
  await page.screenshot({
    path: "test-results/mobile-sign-in.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await login(page, "sam@example.test");
  await expect(
    page.getByRole("heading", { name: "A little progress, every class." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-dashboard.png",
    fullPage: true,
  });
});

test("auth rejects foreign origins and the sign-in form localizes rate limits", async ({
  page,
}) => {
  const foreign = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: "https://untrusted.example" },
    data: { email: "sam@example.test", password },
  });
  expect(foreign.status()).toBe(403);
  await page.goto("/es/sign-in");
  await page.getByLabel("Correo electrónico").fill("sam@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("incorrect-test-password");
  const submit = page.getByRole("button", {
    name: "Iniciar sesión",
    exact: true,
  });
  for (let attempt = 0; attempt < 11; attempt++) {
    await submit.click();
    await expect(submit).toBeEnabled();
    const error = await page.locator("#sign-in-error").textContent();
    if (error?.includes("Demasiados intentos")) break;
    expect(error).toContain("El correo o la contraseña no coinciden");
  }
  await expect(page.locator("#sign-in-error")).toContainText(
    "Demasiados intentos",
  );
});
