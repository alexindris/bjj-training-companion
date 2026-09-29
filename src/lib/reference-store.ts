import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  referencePositions,
  referenceTechniques,
  referenceVideos,
} from "@/db/schema";
import type { ReferenceTarget, SearchState } from "./reference-validation";

export type ReferenceSummary = {
  kind: ReferenceTarget["kind"];
  id: string;
  title: string;
  description: string;
  provenance: string;
  positionId: string | null;
};

export type ReferenceVideo = {
  id: string;
  label: string;
  sourceName: string;
  sourceTitle: string;
  momentLabel: string;
  provenance: string;
  reviewedOn: string;
  startSeconds: number;
  url: string;
};

export type ReferenceDetail = {
  reference: ReferenceSummary;
  parent: ReferenceSummary | null;
  techniques: ReferenceSummary[];
  techniquesHasMore: boolean;
  videos: ReferenceVideo[];
};

function literalPattern(query: string) {
  return `%${query.replace(/[%_\\]/g, "\\$&")}%`;
}

function positionSummary(
  row: typeof referencePositions.$inferSelect,
): ReferenceSummary {
  return { kind: "position", ...row, positionId: null };
}

function techniqueSummary(
  row: typeof referenceTechniques.$inferSelect,
): ReferenceSummary {
  return { kind: "technique", ...row };
}

function videoSummary(
  row: typeof referenceVideos.$inferSelect,
): ReferenceVideo {
  return {
    id: row.id,
    label: row.label,
    sourceName: row.sourceName,
    sourceTitle: row.sourceTitle,
    momentLabel: row.momentLabel,
    provenance: row.provenance,
    reviewedOn: row.reviewedOn,
    startSeconds: row.startSeconds,
    url: row.url,
  };
}

export async function referenceExists(
  target: ReferenceTarget,
): Promise<boolean> {
  const table =
    target.kind === "position" ? referencePositions : referenceTechniques;
  const rows = await db
    .select()
    .from(table)
    .where(eq(table.id, target.referenceId))
    .limit(1);
  return rows.length === 1;
}

export async function listReferences(state: SearchState) {
  const pattern = literalPattern(state.query);
  const positionMatch =
    state.type === "technique" || state.positionId !== null
      ? sql`false`
      : sql`(${referencePositions.title} ilike ${pattern} escape '\\' or ${referencePositions.description} ilike ${pattern} escape '\\')`;
  const techniqueMatch =
    state.type === "position"
      ? sql`false`
      : sql`(${referenceTechniques.title} ilike ${pattern} escape '\\' or ${referenceTechniques.description} ilike ${pattern} escape '\\')`;
  const parentMatch = state.positionId
    ? sql`and ${referenceTechniques.positionId} = ${state.positionId}`
    : sql``;
  const rows = await db.execute<ReferenceSummary>(sql`
    select kind, id, title, description, provenance, position_id as "positionId"
    from (
      select 'position'::text as kind, ${referencePositions.id} as id,
        ${referencePositions.title} as title,
        ${referencePositions.description} as description,
        ${referencePositions.provenance} as provenance,
        null::text as position_id
      from ${referencePositions}
      where ${positionMatch}
      union all
      select 'technique'::text as kind, ${referenceTechniques.id} as id,
        ${referenceTechniques.title} as title,
        ${referenceTechniques.description} as description,
        ${referenceTechniques.provenance} as provenance,
        ${referenceTechniques.positionId} as position_id
      from ${referenceTechniques}
      where ${techniqueMatch} ${parentMatch}
    ) as results
    order by lower(title) collate "C", kind, id
    limit 21 offset ${state.page * 20}
  `);
  return {
    items: rows.rows.slice(0, 20),
    hasMore: rows.rows.length > 20,
    page: state.page,
    query: state.query,
    type: state.type,
    positionId: state.positionId,
  };
}

export async function getReferenceDetail(
  target: ReferenceTarget,
): Promise<ReferenceDetail | null> {
  if (target.kind === "position") {
    const [position] = await db
      .select()
      .from(referencePositions)
      .where(eq(referencePositions.id, target.referenceId))
      .limit(1);
    if (!position) return null;
    const related = await db
      .select()
      .from(referenceTechniques)
      .where(eq(referenceTechniques.positionId, position.id))
      .orderBy(
        sql`lower(${referenceTechniques.title}) collate "C"`,
        referenceTechniques.id,
      )
      .limit(21);
    return {
      reference: positionSummary(position),
      parent: null,
      techniques: related.slice(0, 20).map(techniqueSummary),
      techniquesHasMore: related.length > 20,
      videos: [],
    };
  }
  const [row] = await db
    .select({ technique: referenceTechniques, position: referencePositions })
    .from(referenceTechniques)
    .innerJoin(
      referencePositions,
      eq(referencePositions.id, referenceTechniques.positionId),
    )
    .where(eq(referenceTechniques.id, target.referenceId))
    .limit(1);
  if (!row) return null;
  const videos = await db
    .select()
    .from(referenceVideos)
    .where(eq(referenceVideos.techniqueId, row.technique.id))
    .orderBy(referenceVideos.id)
    .limit(3);
  return {
    reference: techniqueSummary(row.technique),
    parent: positionSummary(row.position),
    techniques: [],
    techniquesHasMore: false,
    videos: videos.map(videoSummary),
  };
}
