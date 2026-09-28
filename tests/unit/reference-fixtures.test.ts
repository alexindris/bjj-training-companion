import { describe, expect, it } from "vitest";
import {
  referenceTechniqueFixtures,
  referenceVideoFixtures,
  validateReferenceFixtures,
} from "@/lib/reference-fixtures";

describe("English reference fixtures", () => {
  it("retains the approved four original technique summaries and reviewed links", () => {
    expect(
      referenceTechniqueFixtures.map(({ id, positionId }) => [id, positionId]),
    ).toEqual([
      ["standing-closed-guard-opening", "closed-guard"],
      ["outside-open-guard-pass", "open-guard"],
      ["side-control-space-recovery", "side-control"],
      ["half-guard-knee-cut-pass", "top-half-guard"],
    ]);
    expect(
      referenceTechniqueFixtures.every((item) =>
        item.provenance.includes("no imported corpus"),
      ),
    ).toBe(true);
    expect(
      referenceVideoFixtures.map(({ techniqueId, startSeconds }) => [
        techniqueId,
        startSeconds,
      ]),
    ).toEqual([
      ["standing-closed-guard-opening", 150],
      ["side-control-space-recovery", 75],
    ]);
    expect(
      validateReferenceFixtures(
        referenceTechniqueFixtures,
        referenceVideoFixtures,
      ).videos,
    ).toHaveLength(2);
  });

  it("fails before seeding malformed or conflicting fixture rows", () => {
    const technique = referenceTechniqueFixtures[0];
    const video = referenceVideoFixtures[0];
    expect(() => validateReferenceFixtures([technique, technique], [])).toThrow(
      "Duplicate technique fixture ID",
    );
    expect(() =>
      validateReferenceFixtures([{ ...technique, positionId: "missing" }], []),
    ).toThrow("Unknown position fixture ID");
    expect(() =>
      validateReferenceFixtures([technique], [video, video]),
    ).toThrow("Duplicate video fixture ID");
    expect(() => validateReferenceFixtures([], [video])).toThrow(
      "Unknown technique fixture ID",
    );
    expect(() =>
      validateReferenceFixtures(
        [technique],
        [{ ...video, url: "javascript:alert(1)" }],
      ),
    ).toThrow("Invalid canonical video fixture URL");
    expect(() =>
      validateReferenceFixtures(
        [technique],
        [{ ...video, url: `${video.url}&t=150s` }],
      ),
    ).toThrow("Invalid canonical video fixture URL");
    expect(() =>
      validateReferenceFixtures([{ ...technique, title: " " }], []),
    ).toThrow();
    expect(() =>
      validateReferenceFixtures(
        [technique],
        [{ ...video, startSeconds: 21_601 }],
      ),
    ).toThrow();
  });
});
