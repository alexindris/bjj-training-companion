import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  referencePositions,
  referenceTechniques,
  referenceVideos,
} from "@/db/schema";

const boundary = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  innerJoin: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: boundary }));

import {
  getReferenceDetail,
  listReferences,
  referenceExists,
} from "@/lib/reference-store";

const base = {
  query: "",
  type: "all" as const,
  page: 0,
  positionId: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  boundary.execute.mockResolvedValue({ rows: [] });
  for (const name of [
    "select",
    "from",
    "where",
    "orderBy",
    "innerJoin",
  ] as const) {
    boundary[name].mockReturnValue(boundary);
  }
  boundary.limit.mockResolvedValue([]);
});

describe("bounded reference search", () => {
  it("parameterizes literal wildcard text with an explicit escape character", async () => {
    await listReferences({ ...base, query: "%_\\" });
    const { sql, params } = new PgDialect().sqlToQuery(
      boundary.execute.mock.calls[0][0],
    );
    expect(params).toEqual([
      "%\\%\\_\\\\%",
      "%\\%\\_\\\\%",
      "%\\%\\_\\\\%",
      "%\\%\\_\\\\%",
      0,
    ]);
    expect(sql).toContain("ilike $1 escape '\\'");
    expect(sql).toContain('order by lower(title) collate "C", kind, id');
    expect(sql).toContain("limit 21 offset $5");
    expect(sql).toMatch(
      /from "reference_techniques"\s+where \([^]*?\)\s*\) as results/,
    );
    expect(sql).not.toContain("reference_notes");
  });

  it("returns only 20 rows and truthfully reports another page", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      kind: "technique",
      id: `technique-${index}`,
      title: "Same title",
      description: "Description",
      provenance: "Original",
      positionId: "closed-guard",
    }));
    boundary.execute.mockResolvedValue({ rows });
    const result = await listReferences({ ...base, page: 10_000 });
    expect(result.items).toEqual(rows.slice(0, 20));
    expect(result.hasMore).toBe(true);
    expect(result.page).toBe(10_000);
    const { params } = new PgDialect().sqlToQuery(
      boundary.execute.mock.calls[0][0],
    );
    expect(params.at(-1)).toBe(200_000);
  });

  it("restricts contextual search to techniques of one position", async () => {
    await listReferences({
      ...base,
      type: "technique",
      positionId: "closed-guard",
      query: "frame",
    });
    const { sql, params } = new PgDialect().sqlToQuery(
      boundary.execute.mock.calls[0][0],
    );
    expect(sql).toContain("where false");
    expect(sql).toContain('"reference_techniques"."position_id" = $3');
    expect(params).toContain("closed-guard");
  });

  it("omits positions when filtering by technique without a parent", async () => {
    await listReferences({ ...base, type: "technique" });
    const { sql } = new PgDialect().sqlToQuery(
      boundary.execute.mock.calls[0][0],
    );
    expect(sql).toContain('from "reference_positions"\n      where false');
  });

  it("omits positions when a parent is supplied with the all type", async () => {
    await listReferences({ ...base, positionId: "closed-guard" });
    const { sql, params } = new PgDialect().sqlToQuery(
      boundary.execute.mock.calls[0][0],
    );
    expect(sql).toContain('from "reference_positions"\n      where false');
    expect(params).toContain("closed-guard");
  });

  it("reports no further page when exactly 20 results are present", async () => {
    boundary.execute.mockResolvedValue({
      rows: Array.from({ length: 20 }, (_, index) => ({ id: `${index}` })),
    });
    const result = await listReferences(base);
    expect(result.items).toHaveLength(20);
    expect(result.hasMore).toBe(false);
  });

  it("excludes techniques for an explicit positions-only search", async () => {
    await listReferences({ ...base, type: "position" });
    const { sql } = new PgDialect().sqlToQuery(
      boundary.execute.mock.calls[0][0],
    );
    expect(sql).toContain('from "reference_techniques"\n      where false');
  });
});

describe("bounded shared detail and existence", () => {
  it.each([
    {
      kind: "position" as const,
      referenceId: "closed-guard",
      table: referencePositions,
    },
    {
      kind: "technique" as const,
      referenceId: "guard-frames",
      table: referenceTechniques,
    },
  ])("checks $kind existence by exact ID", async (target) => {
    boundary.limit.mockResolvedValueOnce([{ id: target.referenceId }]);
    expect(await referenceExists(target)).toBe(true);
    expect(boundary.from).toHaveBeenCalledWith(target.table);
    expect(
      new PgDialect().sqlToQuery(boundary.where.mock.calls[0][0]).params,
    ).toEqual([target.referenceId]);
    expect(await referenceExists(target)).toBe(false);
  });

  it("returns null for a missing shared position without querying children", async () => {
    expect(
      await getReferenceDetail({ kind: "position", referenceId: "missing" }),
    ).toBeNull();
    expect(boundary.from).toHaveBeenCalledExactlyOnceWith(referencePositions);
  });

  it("bounds related techniques and reports overflow", async () => {
    const position = {
      id: "closed-guard",
      title: "Closed guard",
      description: "Description",
      provenance: "Original",
    };
    const related = Array.from({ length: 21 }, (_, index) => ({
      id: `technique-${index}`,
      positionId: position.id,
      title: `Technique ${index}`,
      description: "Description",
      provenance: "Original",
    }));
    boundary.limit
      .mockResolvedValueOnce([position])
      .mockResolvedValueOnce(related);
    const detail = await getReferenceDetail({
      kind: "position",
      referenceId: position.id,
    });
    expect(detail?.reference).toEqual({
      ...position,
      kind: "position",
      positionId: null,
    });
    expect(detail?.techniques).toHaveLength(20);
    expect(detail?.techniquesHasMore).toBe(true);
    expect(detail?.videos).toEqual([]);
    expect(boundary.from).toHaveBeenNthCalledWith(2, referenceTechniques);
    expect(boundary.limit).toHaveBeenNthCalledWith(2, 21);
    const { sql } = new PgDialect().sqlToQuery(
      boundary.orderBy.mock.calls[0][0],
    );
    expect(sql).toBe('lower("reference_techniques"."title") collate "C"');
  });

  it("shows no related overflow at exactly 20 techniques", async () => {
    boundary.limit
      .mockResolvedValueOnce([
        {
          id: "closed-guard",
          title: "Guard",
          description: "D",
          provenance: "P",
        },
      ])
      .mockResolvedValueOnce(
        Array.from({ length: 20 }, (_, index) => ({
          id: `technique-${index}`,
          positionId: "closed-guard",
          title: "Title",
          description: "D",
          provenance: "P",
        })),
      );
    const detail = await getReferenceDetail({
      kind: "position",
      referenceId: "closed-guard",
    });
    expect(detail?.techniques).toHaveLength(20);
    expect(detail?.techniquesHasMore).toBe(false);
  });

  it("returns null for a missing shared technique without querying videos", async () => {
    expect(
      await getReferenceDetail({ kind: "technique", referenceId: "missing" }),
    ).toBeNull();
    expect(boundary.from).toHaveBeenCalledExactlyOnceWith(referenceTechniques);
    expect(boundary.innerJoin).toHaveBeenCalledOnce();
  });

  it("returns parent and at most three attributed videos for a technique", async () => {
    const position = {
      id: "closed-guard",
      title: "Closed guard",
      description: "D",
      provenance: "P",
    };
    const technique = {
      id: "guard-frames",
      positionId: position.id,
      title: "Frames",
      description: "D",
      provenance: "P",
    };
    const videos = [
      {
        id: "video",
        techniqueId: technique.id,
        url: "https://www.youtube.com/watch?v=3B0w4zb51Mk",
        label: "Example",
        sourceName: "Creator",
        sourceTitle: "Title",
        startSeconds: 90,
        momentLabel: "Moment",
        provenance: "Linked",
        reviewedOn: "2026-09-28",
      },
    ];
    boundary.limit
      .mockResolvedValueOnce([{ technique, position }])
      .mockResolvedValueOnce(videos);
    const detail = await getReferenceDetail({
      kind: "technique",
      referenceId: technique.id,
    });
    expect(detail?.reference).toEqual({ ...technique, kind: "technique" });
    expect(detail?.parent).toEqual({
      ...position,
      kind: "position",
      positionId: null,
    });
    expect(detail?.techniquesHasMore).toBe(false);
    expect(detail?.videos).toHaveLength(1);
    expect(detail?.videos[0]).toMatchObject({
      id: "video",
      label: "Example",
      startSeconds: 90,
      sourceName: "Creator",
    });
    expect(detail?.videos[0]).not.toHaveProperty("techniqueId");
    expect(boundary.from).toHaveBeenNthCalledWith(2, referenceVideos);
    expect(boundary.limit).toHaveBeenNthCalledWith(2, 3);
  });
});
