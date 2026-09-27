import { describe, expect, it } from "vitest";
import {
  classSchema,
  focusSchema,
  goalSchema,
  historyPageSchema,
  parseHistoryPage,
  recordIdSchema,
  trainingLimits,
  type ClassInput,
} from "@/lib/training-validation";

const submissionId = "20000000-0000-4000-8000-000000000001";
const goalId = "20000000-0000-4000-8000-000000000002";
const general: ClassInput = {
  submissionId,
  date: "2026-09-27",
  mode: "gi",
  technique: "  Técnica: guard passing\nKnee cut  ",
  goalId: null,
  outcome: null,
  opportunities: null,
  attempts: null,
  successes: null,
  obstacle: "",
  nextCue: "",
};
const linked: ClassInput = { ...general, goalId, outcome: "tried" };

function expectClassError(value: unknown, path: string, message: string) {
  const parsed = classSchema.safeParse(value);
  expect(parsed.success).toBe(false);
  if (parsed.success) throw new Error("Expected invalid class input");
  expect(parsed.error.issues).toContainEqual(
    expect.objectContaining({ path: [path], message }),
  );
}

describe("owned goal input", () => {
  it("keeps required and optional personal text verbatim", () => {
    const input = {
      title: "  Pase de guardia  ",
      notes: "\nKeep the spaces.\n",
    };
    expect(goalSchema.parse(input)).toEqual(input);
    expect(goalSchema.parse({ title: "x", notes: "" })).toEqual({
      title: "x",
      notes: "",
    });
  });

  it.each(["", " ", "\t\n"])("rejects blank title %j", (title) => {
    const parsed = goalSchema.safeParse({ title, notes: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues[0].message).toBe("requiredTitle");
  });

  it.each([
    ["title", 200, "titleTooLong"],
    ["notes", 5_000, "notesTooLong"],
  ] as const)("enforces %s exact text limit", (field, max, code) => {
    expect(
      goalSchema.safeParse({ title: "x", notes: "", [field]: "x".repeat(max) })
        .success,
    ).toBe(true);
    const parsed = goalSchema.safeParse({
      title: "x",
      notes: "",
      [field]: "x".repeat(max + 1),
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues).toContainEqual(
        expect.objectContaining({ path: [field], message: code }),
      );
  });

  it.each([null, {}, { title: 3, notes: "" }, { title: "Valid", notes: null }])(
    "rejects malformed goal %j",
    (input) => {
      expect(goalSchema.safeParse(input).success).toBe(false);
    },
  );

  it("does not carry a submitted owner through the declared input", () => {
    expect(
      goalSchema.parse({ title: "Owned", notes: "", userId: "foreign" }),
    ).toEqual({ title: "Owned", notes: "" });
  });

  it("allows omitted optional notes without inventing content", () => {
    expect(goalSchema.parse({ title: "Valid" })).toEqual({
      title: "Valid",
      notes: "",
    });
  });
});

describe("class date, mode and required text", () => {
  it.each(["gi", "no-gi"])(
    "preserves a valid general class in %s mode",
    (mode) => {
      expect(classSchema.parse({ ...general, mode })).toEqual({
        ...general,
        mode,
      });
    },
  );

  it.each([
    "0001-01-01",
    "9999-12-31",
    "2024-02-29",
    "2000-02-29",
    "2026-01-01",
    "2026-12-31",
    "2026-04-30",
  ])("preserves the real calendar date %s", (date) => {
    expect(classSchema.parse({ ...general, date }).date).toBe(date);
  });

  it.each([
    "",
    "0000-01-01",
    "2026-9-27",
    "27-09-2026",
    "2026-09-27T00:00:00Z",
    "2026-02-29",
    "1900-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-01",
    "2026-01-00",
    "2026-01-32",
    "not a date",
  ])("rejects malformed or nonexistent calendar date %j", (date) => {
    expectClassError({ ...general, date }, "date", "invalidDate");
  });

  it.each(["", "Gi", "nogi", "no_gi", null])(
    "rejects unsupported mode %j",
    (mode) => {
      expectClassError({ ...general, mode }, "mode", "invalidMode");
    },
  );

  it.each(["", " ", "\n\t"])(
    "requires nonblank class technique %j",
    (technique) => {
      expectClassError(
        { ...general, technique },
        "technique",
        "requiredTechnique",
      );
    },
  );

  it("keeps personal class and reflection text including whitespace", () => {
    const input = {
      ...linked,
      obstacle: "  Me faltó tiempo\n",
      nextCue: "\nTry again  ",
    };
    expect(classSchema.parse(input)).toEqual(input);
  });

  it.each([
    ["technique", 2_000, "techniqueTooLong"],
    ["obstacle", 5_000, "reflectionTooLong"],
    ["nextCue", 5_000, "reflectionTooLong"],
  ] as const)(
    "enforces %s text boundary without truncating",
    (field, max, code) => {
      const input = { ...linked, [field]: "x".repeat(max) };
      expect(classSchema.parse(input)).toEqual(input);
      expectClassError({ ...input, [field]: "x".repeat(max + 1) }, field, code);
    },
  );

  it.each([
    null,
    {},
    { ...general, technique: 12 },
    { ...general, obstacle: null },
  ])("rejects wrong input shape %j", (input) => {
    expect(classSchema.safeParse(input).success).toBe(false);
  });

  it("strips an invented owner without changing the declared class", () => {
    expect(classSchema.parse({ ...general, userId: "forged" })).toEqual(
      general,
    );
  });

  it("allows a general class with all optional fields omitted", () => {
    const { submissionId, date, mode, technique } = general;
    expect(classSchema.parse({ submissionId, date, mode, technique })).toEqual(
      general,
    );
    expect(
      classSchema.parse({
        ...linked,
        nextCue: undefined,
        obstacle: undefined,
        opportunities: undefined,
        attempts: undefined,
        successes: undefined,
      }),
    ).toEqual(linked);
  });
});

describe("optional goal observation", () => {
  it.each(["no_opportunity", "tried", "worked_on_something_else"])(
    "accepts the supported outcome %s",
    (outcome) => {
      expect(classSchema.parse({ ...linked, outcome }).outcome).toBe(outcome);
    },
  );

  it("requires an outcome for a selected goal", () => {
    expectClassError(
      { ...linked, outcome: null },
      "outcome",
      "requiredOutcome",
    );
  });

  it.each(["", "success", "TRIED"])(
    "rejects unsupported outcome %j",
    (outcome) => {
      expectClassError({ ...linked, outcome }, "outcome", "invalidOutcome");
    },
  );

  it("requires a goal outcome even when omitted", () => {
    expectClassError(
      { ...linked, outcome: undefined },
      "outcome",
      "requiredOutcome",
    );
  });

  it.each(["no_opportunity", "tried", "worked_on_something_else"])(
    "rejects %s without a goal",
    (outcome) => {
      expectClassError({ ...general, outcome }, "outcome", "invalidOutcome");
    },
  );

  it.each(["obstacle", "nextCue"] as const)(
    "rejects orphan %s text including whitespace",
    (field) => {
      expectClassError(
        { ...general, [field]: " " },
        field,
        "invalidReflection",
      );
    },
  );

  it.each(["", "foreign"])(
    "rejects invalid goal relationship ID %j",
    (goalId) => {
      expectClassError({ ...linked, goalId }, "goalId", "invalidId");
    },
  );
});

describe("nullable bounded whole counts", () => {
  it.each(["opportunities", "attempts", "successes"] as const)(
    "preserves null, entered zero and the %s limit",
    (field) => {
      for (const value of [null, 0, 9_999]) {
        expect(classSchema.parse({ ...linked, [field]: value })[field]).toBe(
          value,
        );
      }
    },
  );

  it.each(["opportunities", "attempts", "successes"] as const)(
    "keeps blank %s unknown and numeric text exact",
    (field) => {
      for (const [raw, expected] of [
        ["", null],
        [" \n", null],
        ["0", 0],
        [" 7 ", 7],
        ["0009", 9],
        ["9999", 9_999],
      ] as const) {
        expect(classSchema.parse({ ...linked, [field]: raw })[field]).toBe(
          expected,
        );
      }
    },
  );

  it.each(["opportunities", "attempts", "successes"] as const)(
    "rejects invalid %s numbers and text",
    (field) => {
      for (const value of [
        -1,
        0.5,
        10_000,
        NaN,
        Infinity,
        "-1",
        "1.5",
        "10000",
        "1e2",
        "+2",
        ".",
        "2-",
        "2a",
        true,
        {},
        [],
      ]) {
        expectClassError({ ...linked, [field]: value }, field, "invalidCount");
      }
    },
  );

  it.each(["opportunities", "attempts", "successes"] as const)(
    "forbids entered %s even zero outside Tried it",
    (field) => {
      for (const outcome of [
        "no_opportunity",
        "worked_on_something_else",
        null,
      ]) {
        expectClassError(
          { ...linked, outcome, [field]: 0 },
          field,
          "invalidCount",
        );
      }
      expectClassError({ ...general, [field]: 0 }, field, "invalidCount");
      expectClassError(
        { ...general, outcome: "tried", [field]: 0 },
        field,
        "invalidCount",
      );
    },
  );

  it.each([
    ["attempts", "opportunities"],
    ["successes", "attempts"],
    ["successes", "opportunities"],
  ] as const)("compares known %s against known %s only", (smaller, larger) => {
    expectClassError(
      { ...linked, [smaller]: 2, [larger]: 1 },
      smaller,
      "invalidCount",
    );
    expect(
      classSchema.safeParse({ ...linked, [smaller]: 1, [larger]: 1 }).success,
    ).toBe(true);
    expect(
      classSchema.safeParse({ ...linked, [smaller]: 0, [larger]: 1 }).success,
    ).toBe(true);
    expect(
      classSchema.parse({ ...linked, [smaller]: 7, [larger]: null })[larger],
    ).toBeNull();
    expect(
      classSchema.parse({ ...linked, [smaller]: null, [larger]: 0 })[smaller],
    ).toBeNull();
    expectClassError(
      { ...linked, [smaller]: 1, [larger]: 0 },
      smaller,
      "invalidCount",
    );
  });

  it("does not infer counts and accepts all-zero or ordered known totals", () => {
    expect(classSchema.parse(linked)).toEqual(linked);
    expect(
      classSchema.parse({
        ...linked,
        opportunities: 0,
        attempts: 0,
        successes: 0,
      }),
    ).toEqual({ ...linked, opportunities: 0, attempts: 0, successes: 0 });
    expect(
      classSchema.safeParse({
        ...linked,
        opportunities: 3,
        attempts: 2,
        successes: 1,
      }).success,
    ).toBe(true);
  });
});

describe("record identities and bounded history pages", () => {
  it("accepts an explicit cleared focus and valid UUIDs", () => {
    expect(focusSchema.parse(null)).toBeNull();
    expect(focusSchema.parse(goalId)).toBe(goalId);
    expect(recordIdSchema.parse(submissionId)).toBe(submissionId);
  });

  it.each(["", "not-a-uuid", 4, undefined])(
    "rejects invalid focus and submission IDs %j",
    (input) => {
      expect(focusSchema.safeParse(input).success).toBe(false);
      expectClassError(
        { ...general, submissionId: input },
        "submissionId",
        "invalidId",
      );
    },
  );

  it.each([0, 1, 10_000])("accepts history page %i", (page) => {
    expect(historyPageSchema.parse(page)).toBe(page);
  });

  it.each([-1, 0.5, 10_001, Infinity, NaN, "1", "", null, undefined])(
    "rejects invalid/unbounded page %j",
    (page) => {
      const parsed = historyPageSchema.safeParse(page);
      expect(parsed.success).toBe(false);
      if (!parsed.success)
        expect(parsed.error.issues[0].message).toBe("invalidPage");
    },
  );

  it("exports the declared visible limits", () => {
    expect(trainingLimits).toEqual({
      title: 200,
      technique: 2_000,
      reflection: 5_000,
      count: 9_999,
      historyPage: 10_000,
    });
  });

  it.each([
    [undefined, 0],
    ["0", 0],
    ["2", 2],
    ["0003", 3],
    ["10000", 10_000],
    [4, 4],
    [0, 0],
  ] as const)(
    "normalizes valid URL history page %j to %i",
    (value, expected) => {
      expect(parseHistoryPage(value)).toBe(expected);
    },
  );

  it.each([
    "",
    " ",
    " 2 ",
    "-1",
    "1.5",
    "1e2",
    "+2",
    "10001",
    "x",
    ["2"],
    null,
    -1,
    0.5,
    10_001,
    Infinity,
  ])("falls back to the first page for invalid URL input %j", (value) => {
    expect(parseHistoryPage(value)).toBe(0);
  });
});
