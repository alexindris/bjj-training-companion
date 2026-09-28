import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { pool } from "../../src/db";
import {
  getReferenceDetail,
  listReferences,
} from "../../src/lib/reference-store";
import {
  deleteOwnNote,
  readOwnNote,
  ReferenceNotFoundError,
  saveOwnNote,
} from "../../src/lib/reference-notes";
import { videoHref } from "../../src/lib/reference-validation";
import type {
  ReferenceTarget,
  SearchState,
} from "../../src/lib/reference-validation";

const position: ReferenceTarget = {
  kind: "position",
  referenceId: "closed-guard",
};
const technique: ReferenceTarget = {
  kind: "technique",
  referenceId: "standing-closed-guard-opening",
};
const violates = (code: string) => (error: unknown) =>
  error instanceof Error && "code" in error && error.code === code;

function state(query = "", overrides: Partial<SearchState> = {}): SearchState {
  return { query, type: "all", page: 0, positionId: null, ...overrides };
}

async function ids(search: SearchState) {
  return (await listReferences(search)).items.map((item) => item.id);
}

async function snapshot() {
  const tables = [
    "users",
    "auth_accounts",
    "auth_sessions",
    "auth_verifications",
    "profiles",
    "reference_positions",
    "reference_techniques",
    "reference_videos",
    "goals",
    "training_sessions",
    "goal_observations",
  ];
  const result: Record<string, unknown> = {};
  for (const table of tables) {
    const order = table === "profiles" ? "user_id" : "id";
    result[table] = (
      await pool.query(`SELECT * FROM ${table} ORDER BY ${order}`)
    ).rows;
  }
  return result;
}

async function addSearchFixtures() {
  const special = [
    ["search-percent", "Literal % marker", "Ordinary description"],
    ["search-underscore", "Literal _ marker", "Ordinary description"],
    ["search-backslash", "Literal \\ marker", "Ordinary description"],
    ["search-provenance", "Ordinary marker", "Ordinary description"],
    ["search-tie-position", "Tie Sample", "Ordinary description"],
  ];
  for (const [id, title, description] of special) {
    await pool.query(
      "INSERT INTO reference_positions(id,title,description,provenance) VALUES ($1,$2,$3,$4)",
      [id, title, description, "HiddenProvenanceNeedle"],
    );
  }
  for (let number = 1; number <= 22; number += 1) {
    await pool.query(
      "INSERT INTO reference_techniques(id,position_id,title,description,provenance) VALUES ($1,$2,$3,$4,$5)",
      [
        `search-tie-${String(number).padStart(2, "0")}`,
        position.referenceId,
        number % 2 === 0 ? "tie sample" : "Tie Sample",
        "Synthetic bounded search entry",
        "Synthetic integration fixture",
      ],
    );
  }
}

async function verifySearch() {
  await addSearchFixtures();
  assert.deepEqual(await ids(state("%")), ["search-percent"]);
  assert.deepEqual(await ids(state("_")), ["search-underscore"]);
  assert.deepEqual(await ids(state("\\")), ["search-backslash"]);
  assert.deepEqual(await ids(state("HIDDENPROVENANCENEEDLE")), []);
  assert.deepEqual(await ids(state("' OR 1=1 --")), []);
  assert.deepEqual(await ids(state("Executing the guard break")), []);
  assert.deepEqual(await ids(state("first control you want")), [
    technique.referenceId,
  ]);
  assert.deepEqual(await ids(state("CLOSED GUARD", { type: "position" })), [
    position.referenceId,
  ]);
  assert.deepEqual(await ids(state("CLOSED GUARD", { type: "technique" })), [
    technique.referenceId,
  ]);
  assert.deepEqual(
    await ids(
      state("Tie Sample", { type: "technique", positionId: "open-guard" }),
    ),
    [],
  );
  const all = state("Tie Sample");
  const first = await listReferences(all);
  const second = await listReferences({ ...all, page: 1 });
  assert.equal(first.items.length, 20);
  assert.equal(first.hasMore, true);
  assert.deepEqual(
    [...first.items, ...second.items].map((item) => item.id),
    [
      "search-tie-position",
      ...Array.from(
        { length: 22 },
        (_, index) => `search-tie-${String(index + 1).padStart(2, "0")}`,
      ),
    ],
  );
  assert.equal(second.hasMore, false);
  assert.deepEqual(await ids({ ...all, page: 2 }), []);
  const contextual = await listReferences(
    state("Tie Sample", {
      type: "technique",
      positionId: position.referenceId,
    }),
  );
  assert.equal(contextual.items.length, 20);
  assert.equal(contextual.hasMore, true);
  assert.equal(
    contextual.items.every((item) => item.positionId === position.referenceId),
    true,
  );
  const detail = await getReferenceDetail(position);
  assert.equal(detail?.techniques.length, 20);
  assert.equal(detail?.techniquesHasMore, true);
  assert.equal(
    await getReferenceDetail({ kind: "position", referenceId: randomUUID() }),
    null,
  );
}

async function verifyVideos() {
  const videos = await pool.query("SELECT * FROM reference_videos ORDER BY id");
  assert.equal(videos.rows.length, 2);
  for (const row of videos.rows) {
    assert.match(
      row.url as string,
      /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/,
    );
    assert.equal(typeof row.start_seconds, "number");
    assert.equal((row.start_seconds as number) > 0, true);
    assert.equal(
      videoHref(row.url as string, row.start_seconds as number),
      `${row.url}&t=${row.start_seconds}s`,
    );
    for (const field of [
      "label",
      "source_name",
      "source_title",
      "moment_label",
      "provenance",
      "reviewed_on",
    ]) {
      assert.equal(Boolean(row[field]), true);
    }
  }
  const detail = await getReferenceDetail(technique);
  assert.equal(detail?.parent?.id, position.referenceId);
  assert.equal(detail?.videos.length, 1);
  assert.equal(detail?.videos[0].id, "closed-guard-opening-chewjitsu");
  await pool.query(
    "INSERT INTO reference_videos(id,technique_id,url,label,source_name,source_title,start_seconds,moment_label,provenance,reviewed_on) VALUES ('search-unsafe-video',$1,'javascript:alert(1)','Unsafe fixture','Synthetic','Synthetic',0,'Unsafe','Synthetic','2026-09-28')",
    [technique.referenceId],
  );
  const unsafe = (await getReferenceDetail(technique))?.videos.find(
    (video) => video.id === "search-unsafe-video",
  );
  assert.equal(unsafe?.url, "javascript:alert(1)");
  assert.equal(videoHref(unsafe.url, unsafe.startSeconds), null);
  await pool.query(
    "DELETE FROM reference_videos WHERE id='search-unsafe-video'",
  );
}

async function insertNote(
  owner: string,
  target: { positionId: string | null; techniqueId: string | null },
  body = "Direct fixture",
) {
  return pool.query(
    "INSERT INTO reference_notes(id,user_id,position_id,technique_id,body) VALUES ($1,$2,$3,$4,$5)",
    [randomUUID(), owner, target.positionId, target.techniqueId, body],
  );
}

async function verifyConstraints(first: string) {
  await assert.rejects(
    insertNote(first, { positionId: null, techniqueId: null }),
    violates("23514"),
  );
  await assert.rejects(
    insertNote(first, {
      positionId: position.referenceId,
      techniqueId: technique.referenceId,
    }),
    violates("23514"),
  );
  await assert.rejects(
    insertNote(randomUUID(), {
      positionId: position.referenceId,
      techniqueId: null,
    }),
    violates("23503"),
  );
  await assert.rejects(
    insertNote(first, { positionId: randomUUID(), techniqueId: null }),
    violates("23503"),
  );
  await assert.rejects(
    insertNote(first, { positionId: null, techniqueId: randomUUID() }),
    violates("23503"),
  );
  for (const body of ["", " \t\n ", "x".repeat(5_001)]) {
    await assert.rejects(
      insertNote(first, { positionId: "open-guard", techniqueId: null }, body),
      violates("23514"),
    );
  }
  await assert.rejects(
    insertNote(first, { positionId: position.referenceId, techniqueId: null }),
    violates("23505"),
  );
  await assert.rejects(
    insertNote(first, { positionId: null, techniqueId: technique.referenceId }),
    violates("23505"),
  );
}

async function verifyNotes(first: string, second: string) {
  const baseline = await snapshot();
  const body = "  Guard cue / señal\n<b>plain text</b>  ";
  assert.equal(await readOwnNote(first, position), null);
  await saveOwnNote(first, { ...position, body });
  await saveOwnNote(first, { ...technique, body: "Technique cue" });
  await saveOwnNote(second, { ...position, body: "Independent cue" });
  await saveOwnNote(second, { ...technique, body: "Independent technique" });
  assert.equal((await readOwnNote(first, position))?.body, body);
  assert.equal((await readOwnNote(second, position))?.body, "Independent cue");
  assert.equal((await readOwnNote(first, technique))?.body, "Technique cue");
  assert.equal(
    await readOwnNote(first, { kind: "position", referenceId: "open-guard" }),
    null,
  );
  assert.equal(
    await readOwnNote(first, { kind: "position", referenceId: randomUUID() }),
    null,
  );
  await saveOwnNote(first, { ...position, body: "Updated position cue" });
  await saveOwnNote(first, { ...technique, body: "Updated technique cue" });
  assert.equal(
    (await readOwnNote(first, position))?.body,
    "Updated position cue",
  );
  assert.equal(
    (await readOwnNote(first, technique))?.body,
    "Updated technique cue",
  );
  assert.equal((await readOwnNote(second, position))?.body, "Independent cue");
  assert.equal(
    (await readOwnNote(second, technique))?.body,
    "Independent technique",
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS count FROM reference_notes WHERE user_id=$1",
        [first],
      )
    ).rows[0].count,
    2,
  );
  await verifyConstraints(first);
  await assert.rejects(
    saveOwnNote(first, {
      kind: "position",
      referenceId: randomUUID(),
      body: "Absent",
    }),
    ReferenceNotFoundError,
  );
  await assert.rejects(
    deleteOwnNote(first, { kind: "technique", referenceId: randomUUID() }),
    ReferenceNotFoundError,
  );
  await saveOwnNote(first, {
    kind: "position",
    referenceId: "open-guard",
    body: "x".repeat(5_000),
  });
  assert.equal(
    (await readOwnNote(first, { kind: "position", referenceId: "open-guard" }))
      ?.body.length,
    5_000,
  );
  await deleteOwnNote(first, { kind: "position", referenceId: "open-guard" });
  await deleteOwnNote(first, position);
  await deleteOwnNote(first, position);
  await deleteOwnNote(first, technique);
  assert.equal(await readOwnNote(first, position), null);
  assert.equal(await readOwnNote(first, technique), null);
  assert.equal((await readOwnNote(second, position))?.body, "Independent cue");
  assert.equal(
    (await readOwnNote(second, technique))?.body,
    "Independent technique",
  );
  assert.deepEqual(await snapshot(), baseline);
  assert.deepEqual(await ids(state("Independent cue")), []);
}

async function verifyReseed(first: string) {
  const changedHash = await hashPassword(randomUUID());
  await pool.query(
    "UPDATE auth_accounts SET password=$1 WHERE user_id=$2 AND provider_id='credential'",
    [changedHash, first],
  );
  await pool.query(
    "UPDATE profiles SET locale='es',timezone='Pacific/Auckland',training_mode='no-gi' WHERE user_id=$1",
    [first],
  );
  await pool.query(
    "UPDATE reference_positions SET title='Customized closed guard',description='Private local correction',provenance='Preserved synthetic provenance' WHERE id=$1",
    [position.referenceId],
  );
  const before = await snapshot();
  const notes = (await pool.query("SELECT * FROM reference_notes ORDER BY id"))
    .rows;
  execFileSync("npm", ["run", "db:seed"], { stdio: "pipe" });
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(
    (await pool.query("SELECT * FROM reference_notes ORDER BY id")).rows,
    notes,
  );
}

try {
  const owners = await pool.query("SELECT id FROM users ORDER BY email");
  assert.equal(owners.rows.length, 2);
  const first = owners.rows[0].id as string;
  const second = owners.rows[1].id as string;
  const counts = await pool.query(
    "SELECT (SELECT count(*)::int FROM reference_positions) AS positions,(SELECT count(*)::int FROM reference_techniques) AS techniques,(SELECT count(*)::int FROM reference_videos) AS videos,(SELECT count(*)::int FROM reference_notes) AS notes",
  );
  assert.deepEqual(counts.rows[0], {
    positions: 4,
    techniques: 4,
    videos: 2,
    notes: 0,
  });
  await verifySearch();
  await verifyVideos();
  await verifyNotes(first, second);
  await verifyReseed(first);
  console.log(
    "PASS: bounded literal SQL search, safe video rows, owned note persistence/constraints and reseed preservation.",
  );
} finally {
  await pool.end();
}
