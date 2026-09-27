import { z } from "zod";

export const trainingLimits = {
  title: 200,
  technique: 2_000,
  reflection: 5_000,
  count: 9_999,
  historyPage: 10_000,
} as const;

export const goalOutcomeSchema = z.enum(
  ["no_opportunity", "tried", "worked_on_something_else"],
  { error: "invalidOutcome" },
);
export type GoalOutcome = z.infer<typeof goalOutcomeSchema>;
export const trainingModeSchema = z.enum(["gi", "no-gi"], {
  error: "invalidMode",
});
export type TrainingMode = z.infer<typeof trainingModeSchema>;
export const recordIdSchema = z.uuid({ error: "invalidId" });
export const focusSchema = recordIdSchema.nullable();
export const historyPageSchema = z
  .number({ error: "invalidPage" })
  .int({ error: "invalidPage" })
  .min(0, { error: "invalidPage" })
  .max(trainingLimits.historyPage, { error: "invalidPage" });

export function parseHistoryPage(value: unknown) {
  const input =
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  const parsed = historyPageSchema.safeParse(input);
  return parsed.success ? parsed.data : 0;
}

function hasNonblankText(text: string) {
  return text.trim().length > 0;
}

function supportedDateYear(date: string) {
  return !date.startsWith("0000");
}

export const goalSchema = z.object({
  title: z
    .string()
    .max(trainingLimits.title, { error: "titleTooLong" })
    .refine(hasNonblankText, "requiredTitle"),
  notes: z
    .string()
    .max(trainingLimits.reflection, { error: "notesTooLong" })
    .default(""),
});
export type GoalInput = z.infer<typeof goalSchema>;

function parseCount(value: unknown) {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (text === "") return null;
  return /^\d+$/.test(text) ? Number(text) : value;
}

const countSchema = z.preprocess(
  parseCount,
  z
    .number({ error: "invalidCount" })
    .int({ error: "invalidCount" })
    .min(0, { error: "invalidCount" })
    .max(trainingLimits.count, { error: "invalidCount" })
    .nullable()
    .default(null),
);
const reflectionSchema = z
  .string()
  .max(trainingLimits.reflection, { error: "reflectionTooLong" });
const classFieldsSchema = z.object({
  submissionId: recordIdSchema,
  date: z.iso
    .date({ error: "invalidDate" })
    .refine(supportedDateYear, "invalidDate"),
  mode: trainingModeSchema,
  technique: z
    .string()
    .max(trainingLimits.technique, { error: "techniqueTooLong" })
    .refine(hasNonblankText, "requiredTechnique"),
  goalId: focusSchema.default(null),
  outcome: goalOutcomeSchema.nullable().default(null),
  opportunities: countSchema,
  attempts: countSchema,
  successes: countSchema,
  obstacle: reflectionSchema.default(""),
  nextCue: reflectionSchema.default(""),
});
export type ClassInput = z.infer<typeof classFieldsSchema>;

function validateObservation(input: ClassInput, context: z.RefinementCtx) {
  if (input.goalId !== null && input.outcome === null) {
    context.addIssue({
      code: "custom",
      path: ["outcome"],
      message: "requiredOutcome",
    });
  }
  if (input.goalId !== null) return;
  if (input.outcome !== null) {
    context.addIssue({
      code: "custom",
      path: ["outcome"],
      message: "invalidOutcome",
    });
  }
  for (const field of ["obstacle", "nextCue"] as const) {
    if (input[field] !== "") {
      context.addIssue({
        code: "custom",
        path: [field],
        message: "invalidReflection",
      });
    }
  }
}

function validateCounts(input: ClassInput, context: z.RefinementCtx) {
  if (input.goalId === null || input.outcome !== "tried") {
    for (const field of ["opportunities", "attempts", "successes"] as const) {
      if (input[field] !== null) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "invalidCount",
        });
      }
    }
  }
  const pairs = [
    ["attempts", "opportunities"],
    ["successes", "attempts"],
    ["successes", "opportunities"],
  ] as const;
  for (const [smaller, larger] of pairs) {
    const low = input[smaller];
    const high = input[larger];
    if (low !== null && high !== null && low > high) {
      context.addIssue({
        code: "custom",
        path: [smaller],
        message: "invalidCount",
      });
    }
  }
}

export const classSchema = classFieldsSchema.superRefine((input, context) => {
  validateObservation(input, context);
  validateCounts(input, context);
});
