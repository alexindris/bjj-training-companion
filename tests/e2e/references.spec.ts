import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Request } from "@playwright/test";
import { Pool } from "pg";
import { assertLocalSeed } from "../../scripts/seed-guard";

const password = assertLocalSeed(process.env);
const databaseName = new URL(process.env.DATABASE_URL!).pathname.slice(1);
if (
  !databaseName.startsWith("bjj_acceptance_") ||
  process.env.BJJ_ACCEPTANCE_DATABASE !== databaseName
) {
  throw new Error("Reference browser checks require a disposable database.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const positionUrl = "/en/library/position/closed-guard";
const techniqueUrl = "/en/library/technique/standing-closed-guard-opening";
const firstNote =
  "  Keep elbows close / mantén la base\n<script>literal</script>  ";
const secondNote = "  Change the first grip\nThen stand.  ";

function isAction(request: Request) {
  return (
    request.method() === "POST" && Boolean(request.headers()["next-action"])
  );
}

async function actionHeaders(request: Request, origin?: string) {
  return {
    "next-action": request.headers()["next-action"],
    "content-type": request.headers()["content-type"],
    origin: origin ?? new URL(process.env.PLAYWRIGHT_BASE_URL!).origin,
  };
}

async function login(page: Page, email = "sam@example.test") {
  await page.goto("/en/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(email.startsWith("jamie") ? /\/es$/ : /\/en$/);
}

async function noteRows() {
  return (
    await pool.query(
      "select u.email,n.position_id,n.technique_id,n.body from reference_notes n join users u on u.id=n.user_id order by u.email,n.position_id nulls last,n.technique_id nulls last",
    )
  ).rows;
}

async function saveNote(page: Page, body: string) {
  await page.getByRole("textbox", { name: "Your private note" }).fill(body);
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(page.getByText(body, { exact: true })).toBeVisible();
}

test.setTimeout(120_000);
test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `198.20.${Math.floor(testInfo.line / 256)}.${testInfo.line % 256}`,
  });
  await pool.query("delete from reference_notes");
  await pool.query(
    "update profiles set locale = case when u.email = 'jamie@example.test' then 'es' else 'en' end from users u where profiles.user_id = u.id and u.email in ('sam@example.test', 'jamie@example.test')",
  );
});
test.afterAll(async () => pool.end());

test("verified request boundary scopes note actions and rejects forged contexts", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto(positionUrl);
  const saveRequest = page.waitForRequest(isAction);
  await saveNote(page, firstNote);
  const capturedSave = await saveRequest;
  const saveHeaders = await actionHeaders(capturedSave);
  const validRepeat = await page.request.post(positionUrl, {
    headers: saveHeaders,
    data: capturedSave.postData()!,
  });
  expect(await validRepeat.text()).toContain('"saved":true');
  expect(await noteRows()).toEqual([
    {
      email: "sam@example.test",
      position_id: "closed-guard",
      technique_id: null,
      body: firstNote,
    },
  ]);

  await page.goto(techniqueUrl);
  const techniqueSaveRequest = page.waitForRequest(isAction);
  await saveNote(page, "Technique-only cue");
  const capturedTechniqueSave = await techniqueSaveRequest;
  const techniqueRepeat = await page.request.post(techniqueUrl, {
    headers: await actionHeaders(capturedTechniqueSave),
    data: capturedTechniqueSave.postData()!,
  });
  expect(await techniqueRepeat.text()).toContain('"saved":true');
  await page.getByRole("button", { name: "Delete note" }).click();
  const deleteRequest = page.waitForRequest(isAction);
  await page.getByRole("button", { name: "Confirm delete" }).click();
  const capturedDelete = await deleteRequest;
  const deleteRepeat = await page.request.post(techniqueUrl, {
    headers: await actionHeaders(capturedDelete),
    data: capturedDelete.postData()!,
  });
  expect(await deleteRepeat.text()).toContain('"deleted":true');
  expect((await noteRows()).map((row) => row.body)).toEqual([firstNote]);

  const extraOwner = await page.request.post(positionUrl, {
    headers: saveHeaders,
    data: JSON.stringify([
      {
        kind: "position",
        referenceId: "closed-guard",
        body: "Forged write",
        userId: randomUUID(),
        noteId: randomUUID(),
      },
    ]),
  });
  expect(await extraOwner.text()).toContain('"error":"invalidInput"');
  const unsupported = await page.request.post(positionUrl, {
    headers: saveHeaders,
    data: JSON.stringify([
      { kind: "video", referenceId: "closed-guard", body: "Forged write" },
    ]),
  });
  expect(await unsupported.text()).toContain('"error":"invalidInput"');
  const missing = await page.request.post(positionUrl, {
    headers: saveHeaders,
    data: JSON.stringify([
      { kind: "position", referenceId: "no-such-position", body: "No" },
    ]),
  });
  expect(await missing.text()).toContain('"error":"notFound"');
  expect((await noteRows())[0].body).toBe(firstNote);
  const missingDetail = await page.goto(
    "/en/library/position/no-such-position",
  );
  expect(missingDetail?.status()).toBe(404);
  await expect(page.getByText(firstNote, { exact: true })).toHaveCount(0);

  const foreignOrigin = await page.request.post(positionUrl, {
    headers: await actionHeaders(capturedSave, "https://foreign.example"),
    data: capturedSave.postData()!,
  });
  expect(foreignOrigin.ok()).toBe(false);
  expect((await noteRows())[0].body).toBe(firstNote);
  await page.goto(positionUrl);
  const sessionCookie = (await page.context().cookies())
    .filter((cookie) => cookie.name.startsWith("better-auth."))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  expect(sessionCookie).not.toBe("");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
  await page.goto(positionUrl);
  await expect(page).toHaveURL(/\/en\/sign-in$/);
  const revoked = await page.request.post(positionUrl, {
    headers: { ...saveHeaders, cookie: sessionCookie },
    data: capturedSave.postData()!,
  });
  expect(await revoked.text()).toContain('"error":"unauthenticated"');

  const otherContext = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": "198.21.0.1" },
  });
  try {
    const jamie = await otherContext.newPage();
    const anonymous = await jamie.request.post(positionUrl, {
      headers: saveHeaders,
      data: capturedSave.postData()!,
    });
    expect(await anonymous.text()).toContain('"error":"unauthenticated"');
    await otherContext.addCookies([
      {
        name: "better-auth.session_token",
        value: "forged-token",
        domain: "localhost",
        path: "/",
      },
    ]);
    await jamie.goto(positionUrl);
    await expect(jamie).toHaveURL(/\/en\/sign-in$/);
    await login(jamie, "jamie@example.test");
    await jamie.goto(positionUrl);
    await expect(jamie.getByText(firstNote, { exact: true })).toHaveCount(0);
    await saveNote(jamie, "Jamie's independent cue");
    const foreignNote = (
      await pool.query(
        "select n.id,n.user_id from reference_notes n join users u on u.id=n.user_id where u.email='sam@example.test'",
      )
    ).rows[0];
    for (const extra of [
      { userId: foreignNote.user_id },
      { noteId: foreignNote.id },
    ]) {
      const forged = await jamie.request.post(positionUrl, {
        headers: saveHeaders,
        data: JSON.stringify([
          {
            kind: "position",
            referenceId: "closed-guard",
            body: "Try to replace Sam's note",
            ...extra,
          },
        ]),
      });
      expect(await forged.text()).toContain('"error":"invalidInput"');
    }
    expect(await noteRows()).toEqual([
      {
        email: "jamie@example.test",
        position_id: "closed-guard",
        technique_id: null,
        body: "Jamie's independent cue",
      },
      {
        email: "sam@example.test",
        position_id: "closed-guard",
        technique_id: null,
        body: firstNote,
      },
    ]);
  } finally {
    await otherContext.close();
  }
});

test("two-account Library journey searches, follows safe links and edits private notes", async ({
  page,
}) => {
  await login(page);
  await page.goto("/en/library");
  await page.getByLabel("Search references").fill("guard");
  await page.getByLabel("Type").selectOption("technique");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/q=guard/);
  await expect(page).toHaveURL(/type=technique/);
  await expect(
    page.getByRole("heading", { name: "Standing closed guard opening" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Search references")).toHaveValue("guard");
  await page.getByLabel("Interface language").selectOption("es");
  await expect(page).toHaveURL(/\/es\/library\?.*q=guard/);
  await expect(page.getByLabel("Buscar referencias")).toHaveValue("guard");
  await expect(
    page.getByRole("heading", { name: "Standing closed guard opening" }),
  ).toBeVisible();
  await page.getByLabel("Idioma de la interfaz").selectOption("en");
  await page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "Standing closed guard opening" }),
    })
    .getByRole("link", { name: "View reference" })
    .click();
  await expect(page).toHaveURL(
    /\/en\/library\/technique\/standing-closed-guard-opening/,
  );
  await expect(page.getByText("Closed guard", { exact: true })).toBeVisible();
  const video = page.getByRole("link", { name: /Open.*new tab/i }).first();
  await expect(video).toHaveAttribute(
    "href",
    /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}&t=\d+s$/,
  );
  await expect(video).toHaveAttribute("target", "_blank");
  await expect(video).toHaveAttribute("rel", /noopener/);
  await expect(page.locator("iframe,video,article img")).toHaveCount(0);
  await saveNote(page, firstNote);
  await page.reload();
  await expect(page.getByText(firstNote, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit note" }).click();
  await page
    .getByRole("textbox", { name: "Your private note" })
    .fill("Unsaved edit");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText(firstNote, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit note" }).click();
  await saveNote(page, secondNote);
  await page.getByRole("button", { name: "Delete note" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText(secondNote, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete note" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await page.reload();
  await expect(page.getByText(secondNote, { exact: true })).toHaveCount(0);
  expect(await noteRows()).toEqual([]);

  await page.goto(positionUrl);
  await saveNote(page, firstNote);
  await page.goto("/en/library?q=Keep%20elbows");
  await expect(page.locator("article")).toHaveCount(0);
  await expect(page.getByText(firstNote, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(page, "jamie@example.test");
  await page.goto("/es/library/position/closed-guard");
  await expect(page.getByText(firstNote, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Guardar nota" }).click();
  await expect(
    page.getByText("Escribe una nota antes de guardarla."),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Tu nota privada" })
    .fill("Una nota independiente");
  await page.getByRole("button", { name: "Guardar nota" }).click();
  await expect(
    page.getByText("Una nota independiente", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Nota guardada.")).toBeVisible();
  expect((await noteRows()).map((row) => [row.email, row.body])).toEqual([
    ["jamie@example.test", "Una nota independiente"],
    ["sam@example.test", firstNote],
  ]);
});

test("mobile keyboard controls, failed save recovery and class draft survive Library", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  await page.goto("/en/log");
  await page
    .getByLabel("Class technique / session focus")
    .fill("Draft survives Library");
  const draft = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((value) =>
      value.startsWith("bjj:class-draft:v1:"),
    );
    if (!key) throw new Error("Expected an account-specific class draft.");
    return { key, value: localStorage.getItem(key) };
  });
  await page.goto("/en/library");
  await page.getByLabel("Search references").focus();
  await expect(page.getByLabel("Search references")).toBeFocused();
  await page.getByLabel("Search references").fill("side control");
  await page.getByLabel("Search references").press("Enter");
  await expect(page).toHaveURL(/q=side/);
  await page.goto(techniqueUrl);
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your private note" }),
  ).toHaveAttribute("aria-invalid", "true");
  await page
    .getByRole("textbox", { name: "Your private note" })
    .fill(firstNote);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/library/technique/**", async (route) => {
    if (!isAction(route.request())) return route.continue();
    await pending;
    await route.fulfill({
      status: 500,
      body: "Temporary test transport failure",
    });
  });
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(
    page.getByRole("textbox", { name: "Your private note" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: /Saving/ })).toBeDisabled();
  release();
  await expect(
    page.getByRole("textbox", { name: "Your private note" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("textbox", { name: "Your private note" }),
  ).toHaveValue(firstNote);
  await expect(
    page.getByText(
      "We could not change your note. Your current input remains here. Please try again.",
    ),
  ).toBeVisible();
  expect(await noteRows()).toEqual([]);
  await expect(page.getByText("Note saved.", { exact: true })).toHaveCount(0);
  await page.unroute("**/library/technique/**");
  const save = page.getByRole("button", { name: "Save note" });
  await save.focus();
  await expect(save).toBeFocused();
  await save.press("Enter");
  await expect(page.getByText(firstNote, { exact: true })).toBeVisible();
  const edit = page.getByRole("button", { name: "Edit note" });
  await edit.focus();
  await expect(edit).toBeFocused();
  await edit.press("Enter");
  await saveNote(page, "A".repeat(400));
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of ["/en/library", positionUrl, techniqueUrl]) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.goto("/en/log");
  await expect(page.getByLabel("Class technique / session focus")).toHaveValue(
    "Draft survives Library",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), draft.key),
  ).toBe(draft.value);
});
