import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../../src/db";
import {
  createOwnedGoal,
  getActiveGoal,
  getOwnedClass,
  listGoals,
  listOwnedHistory,
  saveOwnedClass,
  selectOwnedGoal,
  TrainingNotFoundError,
} from "../../src/lib/training-store";
import type { ClassInput } from "../../src/lib/training-validation";

const general = (): ClassInput => ({
  submissionId: randomUUID(),
  date: "2026-09-27",
  mode: "no-gi",
  technique: "  Guard passing / técnica  ",
  goalId: null,
  outcome: null,
  opportunities: null,
  attempts: null,
  successes: null,
  obstacle: "",
  nextCue: "",
});
const violates = (code: string) => (error: unknown) =>
  error instanceof Error && "code" in error && error.code === code;

try {
  const owners = await pool.query("SELECT id FROM users ORDER BY email");
  const first = owners.rows[0].id as string;
  const second = owners.rows[1].id as string;
  await assert.rejects(
    pool.query("INSERT INTO goals(id,user_id,title) VALUES ($1,$2,$3)", [
      randomUUID(),
      first,
      " \t\n ",
    ]),
    violates("23514"),
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO training_sessions(id,user_id,submission_id,training_date,training_mode,class_technique) VALUES ($1,$2,$3,'2026-09-27','gi',$4)",
      [randomUUID(), first, randomUUID(), " \t\n "],
    ),
    violates("23514"),
  );
  const firstGoal = await createOwnedGoal(first, {
    title: "  Escape / escapar  ",
    notes: "  Original notes  ",
  });
  const replacement = await createOwnedGoal(first, {
    title: "Pass",
    notes: "",
  });
  const foreign = await createOwnedGoal(second, {
    title: "Second account",
    notes: "",
  });
  assert.equal(firstGoal.title, "  Escape / escapar  ");
  assert.equal(firstGoal.notes, "  Original notes  ");
  assert.equal(await getActiveGoal(first), null);
  assert.equal(await getActiveGoal(second), null);
  assert.deepEqual(
    (await listGoals(first)).map((goal) => goal.id).sort(),
    [firstGoal.id, replacement.id].sort(),
  );
  assert.deepEqual(
    (await listGoals(second)).map((goal) => goal.id),
    [foreign.id],
  );
  assert.equal(await selectOwnedGoal(first, firstGoal.id), true);
  assert.equal((await getActiveGoal(first))?.id, firstGoal.id);
  assert.equal(await selectOwnedGoal(first, foreign.id), false);
  assert.equal(await selectOwnedGoal(first, randomUUID()), false);
  assert.equal((await getActiveGoal(first))?.id, firstGoal.id);
  await assert.rejects(
    pool.query("UPDATE profiles SET active_goal_id=$1 WHERE user_id=$2", [
      foreign.id,
      first,
    ]),
    violates("23503"),
  );
  assert.equal(await selectOwnedGoal(first, replacement.id), true);
  assert.equal((await getActiveGoal(first))?.id, replacement.id);
  assert.equal(await selectOwnedGoal(first, null), true);
  assert.equal(await getActiveGoal(first), null);
  assert.equal((await listGoals(first)).length, 2);

  const plain = general();
  const plainReceipt = await saveOwnedClass(first, plain);
  assert.equal(plainReceipt.alreadySaved, false);
  const plainDetail = await getOwnedClass(first, plainReceipt.classId);
  assert.equal(plainDetail?.class.date, plain.date);
  assert.equal(plainDetail?.class.mode, plain.mode);
  assert.equal(plainDetail?.class.technique, plain.technique);
  assert.equal(plainDetail?.observation, null);
  assert.equal(plainDetail?.goal, null);
  assert.equal(await getOwnedClass(second, plainReceipt.classId), null);
  assert.equal(await getOwnedClass(second, randomUUID()), null);

  const linked: ClassInput = {
    ...general(),
    goalId: firstGoal.id,
    outcome: "tried",
    opportunities: null,
    attempts: 0,
    successes: 0,
    obstacle: "  No room / sin espacio  ",
    nextCue: "  Make a frame  ",
  };
  const linkedReceipt = await saveOwnedClass(first, linked);
  const linkedDetail = await getOwnedClass(first, linkedReceipt.classId);
  assert.equal(linkedDetail?.goal?.id, firstGoal.id);
  assert.equal(linkedDetail?.observation?.opportunities, null);
  assert.equal(linkedDetail?.observation?.attempts, 0);
  assert.equal(linkedDetail?.observation?.successes, 0);
  assert.equal(linkedDetail?.observation?.obstacle, linked.obstacle);
  assert.equal(linkedDetail?.observation?.nextCue, linked.nextCue);
  assert.deepEqual(
    await saveOwnedClass(first, {
      ...linked,
      technique: "Edited retry",
      goalId: replacement.id,
      nextCue: "Edited cue",
    }),
    { classId: linkedReceipt.classId, alreadySaved: true },
  );
  assert.deepEqual(
    await getOwnedClass(first, linkedReceipt.classId),
    linkedDetail,
  );
  const otherReceipt = await saveOwnedClass(second, {
    ...linked,
    goalId: foreign.id,
  });
  assert.notEqual(otherReceipt.classId, linkedReceipt.classId);
  assert.equal(otherReceipt.alreadySaved, false);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS count FROM training_sessions WHERE user_id=$1 AND submission_id=$2",
        [first, linked.submissionId],
      )
    ).rows[0].count,
    1,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS count FROM goal_observations WHERE class_id=$1",
        [linkedReceipt.classId],
      )
    ).rows[0].count,
    1,
  );

  const failedForeign = {
    ...general(),
    goalId: foreign.id,
    outcome: "tried" as const,
  };
  await assert.rejects(
    saveOwnedClass(first, failedForeign),
    TrainingNotFoundError,
  );
  const failedMissing = {
    ...general(),
    goalId: randomUUID(),
    outcome: "tried" as const,
  };
  await assert.rejects(
    saveOwnedClass(first, failedMissing),
    TrainingNotFoundError,
  );
  for (const failed of [failedForeign, failedMissing]) {
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM training_sessions WHERE submission_id=$1",
          [failed.submissionId],
        )
      ).rows[0].count,
      0,
    );
  }
  // A database-triggered observation failure must roll back the class too.
  await pool.query(
    "CREATE FUNCTION reject_test_observation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic observation failure'; END $$",
  );
  await pool.query(
    "CREATE TRIGGER reject_test_observation BEFORE INSERT ON goal_observations FOR EACH ROW EXECUTE FUNCTION reject_test_observation()",
  );
  const failedObservation = { ...linked, submissionId: randomUUID() };
  try {
    await assert.rejects(saveOwnedClass(first, failedObservation));
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM training_sessions WHERE submission_id=$1",
          [failedObservation.submissionId],
        )
      ).rows[0].count,
      0,
    );
  } finally {
    await pool.query(
      "DROP TRIGGER reject_test_observation ON goal_observations",
    );
    await pool.query("DROP FUNCTION reject_test_observation()");
  }
  assert.equal(
    (await saveOwnedClass(first, failedObservation)).alreadySaved,
    false,
  );

  const independent = await saveOwnedClass(second, general());
  await assert.rejects(
    pool.query(
      "INSERT INTO goal_observations(id,user_id,class_id,goal_id,outcome) VALUES ($1,$2,$3,$4,'no_opportunity')",
      [randomUUID(), first, independent.classId, firstGoal.id],
    ),
    violates("23503"),
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO goal_observations(id,user_id,class_id,goal_id,outcome) VALUES ($1,$2,$3,$4,'no_opportunity')",
      [randomUUID(), first, plainReceipt.classId, foreign.id],
    ),
    violates("23503"),
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO goal_observations(id,user_id,class_id,goal_id,outcome,attempts) VALUES ($1,$2,$3,$4,'no_opportunity',0)",
      [randomUUID(), first, plainReceipt.classId, firstGoal.id],
    ),
    violates("23514"),
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO goal_observations(id,user_id,class_id,goal_id,outcome,opportunities,attempts,successes) VALUES ($1,$2,$3,$4,'tried',0,1,1)",
      [randomUUID(), first, plainReceipt.classId, firstGoal.id],
    ),
    violates("23514"),
  );
  for (const outcome of [
    "no_opportunity",
    "worked_on_something_else",
  ] as const) {
    const saved = await saveOwnedClass(first, {
      ...general(),
      goalId: firstGoal.id,
      outcome,
    });
    assert.equal(
      (await getOwnedClass(first, saved.classId))?.observation?.outcome,
      outcome,
    );
  }
  assert.equal(await selectOwnedGoal(first, replacement.id), true);
  assert.equal(
    (await getOwnedClass(first, linkedReceipt.classId))?.goal?.id,
    firstGoal.id,
  );

  await pool.query(
    "INSERT INTO training_sessions(id,user_id,submission_id,training_date,training_mode,class_technique,created_at) SELECT 'history-' || lpad(n::text,3,'0'), $1, gen_random_uuid(), '2027-01-01', 'gi', 'Synthetic history ' || n, CASE WHEN n <= 25 THEN '2027-01-01 01:00:00+00'::timestamptz ELSE '2027-01-01 02:00:00+00'::timestamptz END FROM generate_series(1,26) n",
    [first],
  );
  const page = await listOwnedHistory(first, 0);
  assert.equal(page.classes.length, 25);
  assert.equal(page.hasMore, true);
  assert.equal(page.classes[0].id, "history-026");
  assert.equal(page.classes[1].id, "history-025");
  assert.equal(page.classes[24].id, "history-002");
  assert.equal((await listOwnedHistory(first, 1)).classes[0].id, "history-001");
  assert.equal((await listOwnedHistory(first, 1)).hasMore, false);
  assert.deepEqual(await listOwnedHistory(first, 2), {
    classes: [],
    hasMore: false,
  });
  assert.equal((await listOwnedHistory(second, 0)).classes.length, 2);
  for (const invalid of [-1, 0.5, NaN, Infinity, 10001]) {
    await assert.rejects(
      listOwnedHistory(first, invalid),
      /Invalid history page/,
    );
  }
  console.log(
    "PASS: owned goals/focus, complete transactions, rollback/retry, duplicate receipts, cross-account constraints, null/zero counts and bounded ordered history.",
  );
} finally {
  await pool.end();
}
