import { randomUUID } from "node:crypto";
import { test, expect, type Page, type Request } from "@playwright/test";
import { Pool } from "pg";
import { assertLocalSeed } from "../../scripts/seed-guard";

const password = assertLocalSeed(process.env);
const databaseName = new URL(process.env.DATABASE_URL!).pathname.slice(1);
if (
  !databaseName.startsWith("bjj_acceptance_") ||
  process.env.BJJ_ACCEPTANCE_DATABASE !== databaseName
) {
  throw new Error(
    "Browser checks require the disposable database created by npm run test:e2e.",
  );
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const classText = "  Entrada técnica / arm drag\nKeep this personal text.  ";
const reflection = "  Mantener el agarre\nTry again next class.  ";

async function login(page: Page, email = "sam@example.test") {
  await page.goto("/en/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(email.startsWith("jamie") ? /\/es$/ : /\/en$/);
}

async function createGoal(page: Page, title: string) {
  await page.goto("/en/goals");
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Notes", { exact: true }).fill(reflection);
  await page.getByRole("button", { name: "Create goal", exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

function goalCard(page: Page, title: string) {
  return page
    .locator("article")
    .filter({ has: page.getByText(title, { exact: true }) });
}

async function startClass(page: Page, technique = classText) {
  await page.goto("/en/log");
  await page.getByLabel("Class technique / session focus").fill(technique);
}

async function saveClass(page: Page) {
  await page.getByRole("button", { name: "Save class", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  return page
    .getByRole("link", { name: "View saved class", exact: true })
    .getAttribute("href");
}

function isAction(request: Request) {
  return (
    request.method() === "POST" && Boolean(request.headers()["next-action"])
  );
}

async function draft(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((value) =>
      value.startsWith("bjj:class-draft:v1:"),
    );
    if (!key) throw new Error("Expected this account's class draft.");
    return { key, value: localStorage.getItem(key)! };
  });
}

async function actionHeaders(request: Request) {
  return {
    "next-action": request.headers()["next-action"],
    "content-type": "text/plain;charset=UTF-8",
    origin: new URL(process.env.PLAYWRIGHT_BASE_URL!).origin,
  };
}

test.beforeEach(async ({ context }, testInfo) => {
  // Keep independent journeys out of the preceding intentional rate-limit case.
  // These are synthetic client addresses; authentication still uses Better Auth.
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `198.18.${Math.floor(testInfo.line / 256)}.${testInfo.line % 256}`,
  });
  await pool.query("update profiles set active_goal_id = null");
  await pool.query("delete from training_sessions");
  await pool.query("delete from goals");
  await pool.query(
    "update profiles set locale = case when u.email = 'jamie@example.test' then 'es' else 'en' end, training_mode = 'gi' from users u where profiles.user_id = u.id and u.email in ('sam@example.test', 'jamie@example.test')",
  );
});
test.afterAll(async () => pool.end());

test("owned goals replace and clear focus while saved class text and zero counts remain", async ({
  page,
}) => {
  await login(page);
  await page.goto("/en/history");
  await expect(
    page.getByText("No classes yet.", { exact: true }),
  ).toBeVisible();
  await page.goto("/en/goals");
  await page.getByLabel("Title", { exact: true }).fill("   ");
  await page.getByLabel("Notes", { exact: true }).fill(reflection);
  await page.getByRole("button", { name: "Create goal", exact: true }).click();
  await expect(
    page.getByText("Enter a goal title.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("   ");
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    reflection,
  );
  const title = "  Recover half guard / recuperar  ";
  await createGoal(page, title);
  expect((await pool.query("select title,notes from goals")).rows).toEqual([
    { title, notes: reflection },
  ]);
  await page.reload();
  await expect(
    goalCard(page, title).getByRole("button", { name: "Make active" }),
  ).toBeVisible();
  await goalCard(page, title)
    .getByRole("button", { name: "Make active" })
    .click();
  await expect(
    goalCard(page, title).getByText("Active goal", { exact: true }),
  ).toBeVisible();
  await startClass(page);
  const today = await page.evaluate(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue(today);
  await expect(page.getByLabel("Training mode")).toHaveValue("gi");
  await page.getByLabel("Date", { exact: true }).fill("2024-02-29");
  await page.getByLabel("Outcome", { exact: true }).selectOption("tried");
  await page.getByLabel("Attempts", { exact: true }).fill("0");
  await page.getByLabel("Successes", { exact: true }).fill("0");
  await page.getByLabel("Obstacle", { exact: true }).fill(reflection);
  await page.getByLabel("Next cue", { exact: true }).fill("  Elbows close.  ");
  const href = await saveClass(page);
  expect(href).toMatch(/\/en\/history\//);
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          Object.keys(localStorage).filter((key) =>
            key.startsWith("bjj:class-draft:v1:"),
          ).length,
      ),
    )
    .toBe(0);
  const stored = await pool.query(
    "select class_technique, training_date::text, opportunities, attempts, successes, obstacle, next_cue from training_sessions c join goal_observations o on o.class_id=c.id",
  );
  expect(stored.rows).toEqual([
    {
      class_technique: classText,
      training_date: "2024-02-29",
      opportunities: null,
      attempts: 0,
      successes: 0,
      obstacle: reflection,
      next_cue: "  Elbows close.  ",
    },
  ]);
  await page
    .getByRole("link", { name: "View saved class", exact: true })
    .click();
  await expect(page.getByText(classText, { exact: true })).toBeVisible();
  await expect(page.getByText(reflection, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Edit|Delete/ })).toHaveCount(
    0,
  );
  await createGoal(page, "Keep the second grip");
  await goalCard(page, "Keep the second grip")
    .getByRole("button", { name: "Make active" })
    .click();
  await expect(
    goalCard(page, title).getByRole("button", { name: "Make active" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear focus", exact: true }).click();
  await expect(page.getByText("Active goal", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Active goal", { exact: true })).toHaveCount(0);
  await page.goto(href!);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  expect(
    (await pool.query("select count(*)::int as count from goals")).rows[0]
      .count,
  ).toBe(2);
});

test("general classes and all goal outcomes save, and reflection transitions preserve class fields", async ({
  page,
}) => {
  await login(page);
  await startClass(page, "  General class sin objetivo  ");
  await page.getByLabel("Training mode").selectOption("no-gi");
  await saveClass(page);
  expect(
    (await pool.query("select count(*)::int as count from goal_observations"))
      .rows[0].count,
  ).toBe(0);
  await createGoal(page, "First goal");
  await createGoal(page, "Second goal");
  await startClass(page);
  const first = (
    await pool.query("select id from goals where title='First goal'")
  ).rows[0].id;
  const second = (
    await pool.query("select id from goals where title='Second goal'")
  ).rows[0].id;
  await page.getByLabel("Goal", { exact: true }).selectOption(first);
  await page.getByRole("button", { name: "Save class", exact: true }).click();
  await expect(
    page.getByText("Choose an outcome for this goal.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Outcome", { exact: true }).selectOption("tried");
  await page.getByLabel("Opportunities", { exact: true }).fill("3");
  await page.getByLabel("Obstacle", { exact: true }).fill(reflection);
  await page
    .getByLabel("Outcome", { exact: true })
    .selectOption("no_opportunity");
  await expect(page.getByLabel("Opportunities", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Outcome", { exact: true }).selectOption("tried");
  await expect(page.getByLabel("Opportunities", { exact: true })).toHaveValue(
    "",
  );
  await page.getByLabel("Goal", { exact: true }).selectOption(second);
  await expect(page.getByLabel("Outcome", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Obstacle", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Class technique / session focus")).toHaveValue(
    classText,
  );
  await page.getByLabel("Next cue", { exact: true }).fill(reflection);
  await page.getByLabel("Goal", { exact: true }).selectOption("");
  await expect(page.getByLabel("Outcome", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Class technique / session focus")).toHaveValue(
    classText,
  );
  await page.getByLabel("Goal", { exact: true }).selectOption(second);
  await expect(page.getByLabel("Next cue", { exact: true })).toHaveValue("");
  await page
    .getByLabel("Outcome", { exact: true })
    .selectOption("no_opportunity");
  await saveClass(page);
  await startClass(page, "Work on something else today");
  await page.getByLabel("Goal", { exact: true }).selectOption(first);
  await page
    .getByLabel("Outcome", { exact: true })
    .selectOption("worked_on_something_else");
  await page.getByLabel("Next cue", { exact: true }).fill(reflection);
  await saveClass(page);
  expect(
    (
      await pool.query(
        "select outcome, opportunities, attempts, successes from goal_observations order by outcome",
      )
    ).rows,
  ).toEqual([
    {
      outcome: "no_opportunity",
      opportunities: null,
      attempts: null,
      successes: null,
    },
    {
      outcome: "worked_on_something_else",
      opportunities: null,
      attempts: null,
      successes: null,
    },
  ]);
});

test("partial drafts recover before defaults and keep their goal and date across focus and locale changes", async ({
  page,
}) => {
  await login(page);
  await createGoal(page, "Draft goal");
  await createGoal(page, "New active goal");
  const goals = await pool.query("select id,title from goals");
  const originalGoal = goals.rows.find(
    (goal) => goal.title === "Draft goal",
  ).id;
  await startClass(page, "");
  await page.getByLabel("Date", { exact: true }).fill("");
  await page.getByLabel("Goal", { exact: true }).selectOption(originalGoal);
  await page.getByLabel("Outcome", { exact: true }).selectOption("tried");
  await page.getByLabel("Attempts", { exact: true }).fill("1.");
  await page.getByLabel("Obstacle", { exact: true }).fill(reflection);
  const before = await draft(page);
  await page.reload();
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Class technique / session focus")).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Attempts", { exact: true })).toHaveValue("1.");
  expect(await draft(page)).toEqual(before);
  await page.goto("/en/goals");
  await goalCard(page, "New active goal")
    .getByRole("button", { name: "Make active" })
    .click();
  await expect(
    goalCard(page, "New active goal").getByText("Active goal", { exact: true }),
  ).toBeVisible();
  await page.goto("/en/log");
  await expect(page.getByLabel("Goal", { exact: true })).toHaveValue(
    originalGoal,
  );
  await page.getByLabel("Date", { exact: true }).fill("2024-02-29");
  await page.getByLabel("Class technique / session focus").fill(classText);
  await page.getByLabel("Interface language").selectOption("es");
  await expect(page).toHaveURL(/\/es\/log$/);
  await expect(page.getByLabel("Fecha", { exact: true })).toHaveValue(
    "2024-02-29",
  );
  await expect(
    page.getByLabel("Técnica de clase / enfoque de la sesión"),
  ).toHaveValue(classText);
  await expect(page.getByLabel("Intentos", { exact: true })).toHaveValue("1.");
  await page
    .getByRole("button", { name: "Guardar clase", exact: true })
    .click();
  await expect(
    page.getByText("Introduce un número entero entre 0 y 9.999."),
  ).toBeVisible();
  await page.getByLabel("Intentos", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "Guardar clase", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Guardado");
  await page
    .getByRole("link", { name: "Ver clase guardada", exact: true })
    .click();
  await expect(page.getByText("Lo intenté", { exact: true })).toBeVisible();
  await expect(page.getByText(classText, { exact: true })).toBeVisible();
  await expect(page.getByText(reflection, { exact: true })).toBeVisible();
  await page.goto("/es/log");
  await page
    .getByLabel("Técnica de clase / enfoque de la sesión")
    .fill("Borrador para descartar");
  await page
    .getByRole("button", { name: "Descartar borrador", exact: true })
    .click();
  await expect(
    page.getByLabel("Técnica de clase / enfoque de la sesión"),
  ).toHaveValue("");
  expect(
    (await pool.query("select count(*)::int as count from training_sessions"))
      .rows[0].count,
  ).toBe(1);
});

test("ordinary failure keeps fields and submission ID, disables pending controls, then retries once", async ({
  page,
}) => {
  await login(page);
  await startClass(page);
  const before = await draft(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/en/log", async (route) => {
    if (!isAction(route.request())) return route.continue();
    await pending;
    await route.fulfill({
      status: 500,
      body: "Temporary test-controlled transport failure",
    });
  });
  await page.getByRole("button", { name: "Save class", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saving");
  await expect(
    page.getByRole("button", { name: /Sav(e class|ing)/ }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Class technique / session focus"),
  ).toBeDisabled();
  release();
  await expect(page.getByText("Save failed", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Class technique / session focus")).toHaveValue(
    classText,
  );
  expect(await draft(page)).toEqual(before);
  await page.unroute("**/en/log");
  await saveClass(page);
  expect(
    (await pool.query("select count(*)::int as count from training_sessions"))
      .rows[0].count,
  ).toBe(1);
});

test("duplicate receipt preserves edited retry input and links the original class without overwriting", async ({
  page,
}) => {
  await login(page);
  await startClass(page, "Original saved technique");
  const originalDraft = await draft(page);
  const href = await saveClass(page);
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    originalDraft,
  );
  await page.reload();
  await expect(page.getByLabel("Class technique / session focus")).toHaveValue(
    "Original saved technique",
  );
  await page
    .getByLabel("Class technique / session focus")
    .fill("Edited retry text must remain unsaved");
  const editedDraft = await draft(page);
  await page.getByRole("button", { name: "Save class", exact: true }).click();
  await expect(page.getByText("Already saved", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View saved class", exact: true }),
  ).toHaveAttribute("href", href!);
  await expect(page.getByLabel("Class technique / session focus")).toHaveValue(
    "Edited retry text must remain unsaved",
  );
  expect(await draft(page)).toEqual(editedDraft);
  expect(
    (await pool.query("select class_technique from training_sessions")).rows,
  ).toEqual([{ class_technique: "Original saved technique" }]);
  await page
    .getByRole("link", { name: "View saved class", exact: true })
    .click();
  await expect(
    page.getByText("Original saved technique", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Edited retry text must remain unsaved", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/en/log");
  await expect(page.getByLabel("Class technique / session focus")).toHaveValue(
    "Edited retry text must remain unsaved",
  );
  await page
    .getByRole("button", { name: "Discard draft", exact: true })
    .click();
  expect(
    (await pool.query("select count(*)::int as count from training_sessions"))
      .rows[0].count,
  ).toBe(1);
});

test("accounts hide each other's drafts, focus and history and reject forged foreign actions", async ({
  page,
  browser,
}) => {
  await login(page);
  await createGoal(page, "Sam private goal");
  await goalCard(page, "Sam private goal")
    .getByRole("button", { name: "Make active" })
    .click();
  await expect(
    goalCard(page, "Sam private goal").getByText("Active goal", {
      exact: true,
    }),
  ).toBeVisible();
  await startClass(page, "Sam saved class");
  await page
    .getByLabel("Outcome", { exact: true })
    .selectOption("no_opportunity");
  const samClass = await saveClass(page);
  await startClass(page, "Sam unfinished draft");
  const samDraft = await draft(page);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
  await page.goto("/en/log");
  await expect(page).toHaveURL(/\/en\/sign-in$/);
  await login(page, "jamie@example.test");
  await page.goto("/en/log");
  await expect(page.getByLabel("Class technique / session focus")).toHaveValue(
    "",
  );
  await expect(page.getByLabel("Goal", { exact: true })).toHaveValue("");
  await page.goto("/en/goals");
  await expect(page.getByText("Sam private goal", { exact: true })).toHaveCount(
    0,
  );
  await createGoal(page, "Jamie private goal");
  const actionRequest = page.waitForRequest(isAction);
  await goalCard(page, "Jamie private goal")
    .getByRole("button", { name: "Make active" })
    .click();
  const capturedFocus = await actionRequest;
  await expect(
    goalCard(page, "Jamie private goal").getByText("Active goal", {
      exact: true,
    }),
  ).toBeVisible();
  const samGoal = (
    await pool.query(
      "select id,user_id from goals where title='Sam private goal'",
    )
  ).rows[0];
  const forged = await page.request.post("/en/goals", {
    headers: await actionHeaders(capturedFocus),
    data: JSON.stringify([samGoal.id]),
  });
  expect(forged.status()).toBe(200);
  expect(await forged.text()).toContain('"error":"notFound"');
  const nonexistent = await page.request.post("/en/goals", {
    headers: await actionHeaders(capturedFocus),
    data: JSON.stringify([randomUUID()]),
  });
  expect(await nonexistent.text()).toContain('"error":"notFound"');
  await page.goto(samClass!);
  await expect(page.getByText("Sam saved class", { exact: true })).toHaveCount(
    0,
  );
  const foreignBody = await page.locator("main").innerText();
  await page.goto(`/en/history/${randomUUID()}`);
  expect(await page.locator("main").innerText()).toBe(foreignBody);
  await startClass(page, "Jamie saved class");
  const jamieGoal = (
    await pool.query("select id from goals where title='Jamie private goal'")
  ).rows[0].id;
  await page.getByLabel("Goal", { exact: true }).selectOption(jamieGoal);
  await page.getByLabel("Outcome", { exact: true }).selectOption("tried");
  const saveRequest = page.waitForRequest(isAction);
  await saveClass(page);
  const capturedSave = await saveRequest;
  const foreignRelationship = await page.request.post("/en/log", {
    headers: await actionHeaders(capturedSave),
    data: JSON.stringify([
      {
        submissionId: randomUUID(),
        date: "2024-02-29",
        mode: "gi",
        technique: "Forged foreign relationship",
        goalId: samGoal.id,
        outcome: "no_opportunity",
        opportunities: null,
        attempts: null,
        successes: null,
        obstacle: "",
        nextCue: "",
        userId: samGoal.user_id,
      },
    ]),
  });
  expect(await foreignRelationship.text()).toContain('"error":"notFound"');
  const forgedOwner = await page.request.post("/en/log", {
    headers: await actionHeaders(capturedSave),
    data: JSON.stringify([
      {
        submissionId: randomUUID(),
        date: "2024-02-29",
        mode: "gi",
        technique: "Owner derived from Jamie's verified session",
        goalId: null,
        outcome: null,
        opportunities: null,
        attempts: null,
        successes: null,
        obstacle: "",
        nextCue: "",
        userId: samGoal.user_id,
      },
    ]),
  });
  expect(await forgedOwner.text()).toContain('"classId"');
  expect(
    (
      await pool.query(
        "select u.email from training_sessions c join users u on u.id=c.user_id where c.class_technique=$1",
        ["Owner derived from Jamie's verified session"],
      )
    ).rows,
  ).toEqual([{ email: "jamie@example.test" }]);
  expect(
    (await pool.query("select count(*)::int as count from training_sessions"))
      .rows[0].count,
  ).toBe(3);
  await page.goto("/en/history");
  await expect(
    page.getByText("Jamie saved class", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Sam saved class", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
  await login(page);
  await page.goto("/en/log");
  await expect(page.getByLabel("Class technique / session focus")).toHaveValue(
    "Sam unfinished draft",
  );
  const recovered = await page.evaluate(
    ({ key }) => localStorage.getItem(key),
    samDraft,
  );
  expect(recovered).toBe(samDraft.value);
  const independent = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": "198.19.0.1" },
  });
  const sam = await independent.newPage();
  const anonymousFocus = await sam.request.post("/en/goals", {
    headers: await actionHeaders(capturedFocus),
    data: JSON.stringify([samGoal.id]),
  });
  expect(await anonymousFocus.text()).toContain('"error":"unauthenticated"');
  const anonymousSave = await sam.request.post("/en/log", {
    headers: await actionHeaders(capturedSave),
    data: capturedSave.postData()!,
  });
  expect(await anonymousSave.text()).toContain('"error":"unauthenticated"');
  await login(sam);
  await sam.goto("/en/log");
  await expect(sam.getByLabel("Class technique / session focus")).toHaveValue(
    "",
  );
  await independent.close();
});

test("unavailable and malformed browser storage keep input safe and never auto-save", async ({
  page,
}) => {
  await login(page);
  await startClass(page, "Before storage corruption");
  const stored = await draft(page);
  await page.evaluate(
    ({ key }) => localStorage.setItem(key, "{malformed"),
    stored,
  );
  await page.reload();
  await expect(
    page.getByText(
      "The stored draft could not be recovered. A fresh form is ready; no stored data was submitted.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Class technique / session focus")).toHaveValue(
    "",
  );
  expect(
    (await pool.query("select count(*)::int as count from training_sessions"))
      .rows[0].count,
  ).toBe(0);
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage unavailable", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage unavailable", "SecurityError");
    };
    Storage.prototype.removeItem = () => {
      throw new DOMException("Storage unavailable", "SecurityError");
    };
  });
  await page.reload();
  await expect(
    page.getByText(
      "Draft recovery is unavailable on this browser. Keep this page open until you save.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("Class technique / session focus").fill(classText);
  await expect(page.getByLabel("Class technique / session focus")).toHaveValue(
    classText,
  );
  await saveClass(page);
  expect(
    (await pool.query("select class_technique from training_sessions")).rows,
  ).toEqual([{ class_technique: classText }]);
});

test("history is bounded and ordered with older pages and usable mobile controls", async ({
  page,
}) => {
  await login(page);
  const owner = (
    await pool.query("select id from users where email='sam@example.test'")
  ).rows[0].id;
  for (let index = 0; index < 27; index++) {
    await pool.query(
      "insert into training_sessions (id,user_id,submission_id,training_date,training_mode,class_technique,created_at) values ($1,$2,$3,$4,'gi',$5,$6)",
      [
        randomUUID(),
        owner,
        randomUUID(),
        index < 2 ? "2024-02-28" : "2024-02-29",
        `History class ${String(index).padStart(2, "0")}`,
        new Date(Date.UTC(2024, 1, 29, 0, 0, index)),
      ],
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/history");
  const classes = page.getByRole("heading", { name: /History class/ });
  await expect(classes).toHaveCount(25);
  expect(await classes.allTextContents()).toEqual(
    Array.from(
      { length: 25 },
      (_, index) => `History class ${String(26 - index).padStart(2, "0")}`,
    ),
  );
  await expect(page.getByText("History class 00", { exact: true })).toHaveCount(
    0,
  );
  const older = page.getByRole("link", { name: "Older classes", exact: true });
  await older.click();
  await expect(
    page.getByRole("heading", { name: /History class/ }),
  ).toHaveCount(2);
  await expect(
    page.getByText("History class 00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Older classes", exact: true }),
  ).toHaveCount(0);
  await page.goto("/en/log");
  await page.getByRole("button", { name: "Save class", exact: true }).click();
  await expect(
    page.getByText("Enter your class technique or session focus.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Class technique / session focus").focus();
  await expect(
    page.getByLabel("Class technique / session focus"),
  ).toBeFocused();
  for (const route of ["/en/log", "/en/goals", "/en/history"]) {
    await page.goto(route);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
