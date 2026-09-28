import { describe, expect, it } from "vitest";
import {
  deleteReferenceNoteSchema,
  formatStartTime,
  parseCuratedVideoUrl,
  parseSearchState,
  referenceSearchLimits,
  referenceTargetSchema,
  saveReferenceNoteSchema,
  videoHref,
} from "@/lib/reference-validation";

const target = { kind: "technique", referenceId: "outside-open-guard-pass" };
const videoId = "3B0w4zb51Mk";
const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

describe("reference search input", () => {
  it("defaults to unfiltered browse and trims a literal query", () => {
    expect(parseSearchState({})).toEqual({
      query: "",
      type: "all",
      page: 0,
      positionId: null,
    });
    expect(
      parseSearchState({ q: "  Guard %_\\  ", type: "technique", page: "2" }),
    ).toEqual({
      query: "Guard %_\\",
      type: "technique",
      page: 2,
      positionId: null,
    });
    expect(parseSearchState({ q: " \t\n " })?.query).toBe("");
  });

  it("bounds raw query and page without limiting unrelated keys", () => {
    expect(
      parseSearchState({ q: "x".repeat(100), page: "10000", ignored: "z" }),
    ).toEqual({
      query: "x".repeat(100),
      type: "all",
      page: 10_000,
      positionId: null,
    });
    expect(parseSearchState({ q: " x".repeat(51) })).toBeNull();
    expect(parseSearchState({ page: "10001" })).toBeNull();
  });

  it("forces contextual position browsing to technique type", () => {
    expect(parseSearchState({ position: "closed-guard" })).toEqual({
      query: "",
      type: "technique",
      page: 0,
      positionId: "closed-guard",
    });
    expect(
      parseSearchState({ position: "closed-guard", type: "all" })?.type,
    ).toBe("technique");
    expect(
      parseSearchState({ position: "closed-guard", type: "position" }),
    ).toBeNull();
    expect(parseSearchState({ type: "position" })?.type).toBe("position");
  });

  it.each([
    { q: ["a", "b"] },
    { type: ["all"] },
    { page: ["0"] },
    { position: ["closed-guard"] },
    { type: "video" },
    { page: "-1" },
    { page: "1.2" },
    { page: "1e2" },
    { page: "NaN" },
    { page: "Infinity" },
    { page: "" },
    { position: "" },
    { position: "   " },
    { position: "x".repeat(201) },
  ])("rejects malformed recognized search parameter %j", (raw) => {
    expect(parseSearchState(raw)).toBeNull();
  });
});

describe("reference and owned-note input", () => {
  it("accepts only position or technique targets and strict fields", () => {
    expect(referenceTargetSchema.parse(target)).toEqual(target);
    expect(
      referenceTargetSchema.parse({ ...target, kind: "position" }).kind,
    ).toBe("position");
    expect(
      deleteReferenceNoteSchema.safeParse({ ...target, noteId: "foreign" })
        .success,
    ).toBe(false);
    expect(
      referenceTargetSchema.safeParse({ ...target, userId: "foreign" }).success,
    ).toBe(false);
    expect(
      referenceTargetSchema.safeParse({ ...target, kind: "video" }).success,
    ).toBe(false);
    expect(
      referenceTargetSchema.safeParse({
        ...target,
        referenceId: "x".repeat(201),
      }).success,
    ).toBe(false);
    expect(
      referenceTargetSchema.safeParse({ ...target, referenceId: " " }).success,
    ).toBe(false);
  });

  it("preserves personal text exactly through the UTF-16 limit", () => {
    const body = `  Español 🥋\n${"x".repeat(5_000 - 15)}  `;
    expect(body.length).toBeLessThanOrEqual(referenceSearchLimits.noteBody);
    expect(saveReferenceNoteSchema.parse({ ...target, body }).body).toBe(body);
    expect(
      saveReferenceNoteSchema.parse({ ...target, body: "x".repeat(5_000) }).body
        .length,
    ).toBe(5_000);
    expect(
      saveReferenceNoteSchema.safeParse({ ...target, body: "🦊".repeat(2_501) })
        .success,
    ).toBe(false);
  });

  it("rejects blank, oversized and forged note data", () => {
    for (const body of ["", "\n \t", "x".repeat(5_001)]) {
      expect(
        saveReferenceNoteSchema.safeParse({ ...target, body }).success,
      ).toBe(false);
    }
    expect(
      saveReferenceNoteSchema.safeParse({
        ...target,
        body: "Valid",
        userId: "other",
      }).success,
    ).toBe(false);
    expect(
      saveReferenceNoteSchema.safeParse({
        ...target,
        body: "Valid",
        noteId: "other",
      }).success,
    ).toBe(false);
  });
});

describe("curated YouTube links", () => {
  it("accepts exact watch and short URLs and canonicalizes time", () => {
    expect(parseCuratedVideoUrl(canonicalUrl)).toEqual({
      url: canonicalUrl,
      videoId,
      startSeconds: 0,
    });
    expect(
      parseCuratedVideoUrl(`https://youtu.be/${videoId}?t=90s`, "1:30")
        ?.startSeconds,
    ).toBe(90);
    expect(
      parseCuratedVideoUrl(`https://youtu.be/${videoId}`)?.startSeconds,
    ).toBe(0);
    expect(
      parseCuratedVideoUrl(`https://youtu.be/${videoId}?t=90`)?.startSeconds,
    ).toBe(90);
    expect(
      parseCuratedVideoUrl(`https://youtube.com/watch?t=90&v=${videoId}`, 90)
        ?.url,
    ).toBe(canonicalUrl);
    expect(parseCuratedVideoUrl(canonicalUrl, "1:01:01")?.startSeconds).toBe(
      3_661,
    );
    expect(parseCuratedVideoUrl(canonicalUrl, "6:00:00")?.startSeconds).toBe(
      21_600,
    );
    expect(parseCuratedVideoUrl(canonicalUrl, 21_600)?.startSeconds).toBe(
      21_600,
    );
    expect(parseCuratedVideoUrl(`${canonicalUrl}&t=21600`)?.startSeconds).toBe(
      21_600,
    );
    expect(parseCuratedVideoUrl(canonicalUrl, "12:34")?.startSeconds).toBe(754);
    expect(parseCuratedVideoUrl(canonicalUrl, "0:59")?.startSeconds).toBe(59);
    expect(parseCuratedVideoUrl(canonicalUrl, "1:00:59")?.startSeconds).toBe(
      3_659,
    );
    expect(videoHref(canonicalUrl, 0)).toBe(`${canonicalUrl}&t=0s`);
    expect(videoHref(canonicalUrl, 150)).toBe(`${canonicalUrl}&t=150s`);
  });

  it.each([
    `http://www.youtube.com/watch?v=${videoId}`,
    `xhttps://youtube.com/watch?v=${videoId}`,
    `javascript:alert(1)`,
    `//youtube.com/watch?v=${videoId}`,
    `https://youtube.com.evil.test/watch?v=${videoId}`,
    `https://user@youtube.com/watch?v=${videoId}`,
    `https://youtube.com:444/watch?v=${videoId}`,
    `https://youtube.com/embed/${videoId}`,
    `https://youtube.com/shorts/${videoId}`,
    `https://youtu.be/${videoId}/extra`,
    `https://youtube.com/watch?v=short`,
    `https://youtube.com/watch?v=${videoId}&v=${videoId}`,
    `https://youtube.com/watch?v=${videoId}&list=playlist`,
    `https://youtube.com/watch?v=${videoId}#chapter`,
    `https://youtube.com/watch?v=${videoId}&t=1.5`,
    `https://youtube.com/watch?v=${videoId}&t=-5`,
    `https://youtube.com/watch?v=${videoId}&t=21601`,
    `https://youtu.be/${videoId}?t=1&t=2`,
    `https://youtu.be/${videoId}#fragment`,
    `https://youtube.com/other?v=${videoId}`,
    `https://youtu.be/${videoId}?v=${videoId}`,
    `https://youtu.be/X${videoId}`,
    `https://youtube.com/watch?v=%33B0w4zb51Mk`,
    `https://youtube.com/watch?v=${videoId}&`,
    `https://youtube.com/watch?\tv=${videoId}`,
    `https://youtube.com/watch?v=${videoId}\t`,
  ])("rejects unsupported URL %s", (url) => {
    expect(parseCuratedVideoUrl(url)).toBeNull();
    expect(videoHref(url, 90)).toBeNull();
  });

  it.each([
    "90",
    "-1:00",
    "1:60",
    "1:00:60",
    "0:1",
    "1:2:03",
    "6:00:01",
    "1e2",
    "1:02:03:04",
    " 1:01",
    "1 :01",
    "1: 01",
    "1:01 ",
    "1:00: 01",
    "1:00:01 ",
    1.5,
    -1,
    21_601,
  ])("rejects invalid explicit curator time %j", (start) => {
    expect(parseCuratedVideoUrl(canonicalUrl, start)).toBeNull();
  });

  it("rejects conflicting embedded time and corrupted stored link", () => {
    expect(parseCuratedVideoUrl(`${canonicalUrl}&t=90s`, 91)).toBeNull();
    expect(videoHref(`${canonicalUrl}&t=90s`, 91)).toBeNull();
    expect(videoHref(canonicalUrl, Number.NaN)).toBeNull();
  });

  it("formats zero, minutes and hours without accepting invalid seconds", () => {
    expect(formatStartTime(0)).toBe("0:00");
    expect(formatStartTime(75)).toBe("1:15");
    expect(formatStartTime(3_661)).toBe("1:01:01");
    expect(formatStartTime(21_600)).toBe("6:00:00");
    for (const seconds of [-1, 1.5, 21_601, Number.NaN]) {
      expect(formatStartTime(seconds)).toBeNull();
    }
  });
});
