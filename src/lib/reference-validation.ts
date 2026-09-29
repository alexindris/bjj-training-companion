import { z } from "zod";

export const referenceSearchLimits = {
  query: 100,
  page: 10_000,
  pageSize: 20,
  targetId: 200,
  noteBody: 5_000,
  videoSeconds: 21_600,
} as const;

export const referenceKindSchema = z.enum(["position", "technique"]);
const referenceIdSchema = z
  .string()
  .min(1)
  .max(referenceSearchLimits.targetId)
  .refine(hasNonblankText);
export const referenceTargetSchema = z.strictObject({
  kind: referenceKindSchema,
  referenceId: referenceIdSchema,
});
export type ReferenceTarget = z.infer<typeof referenceTargetSchema>;

export const saveReferenceNoteSchema = referenceTargetSchema.extend({
  body: z
    .string()
    .refine(bodyWithinLimit, "noteTooLong")
    .refine(hasNonblankText, "requiredNote"),
});
export const deleteReferenceNoteSchema = referenceTargetSchema;

export type SearchState = {
  query: string;
  type: "all" | "position" | "technique";
  page: number;
  positionId: string | null;
};

function hasNonblankText(value: string) {
  return value.trim().length > 0;
}

function bodyWithinLimit(value: string) {
  return value.length <= referenceSearchLimits.noteBody;
}

function pageWithinLimit(value: string) {
  return Number(value) <= referenceSearchLimits.page;
}

const searchSchema = z.object({
  q: z.string().max(referenceSearchLimits.query).optional(),
  type: z.enum(["all", "position", "technique"]).optional(),
  page: z.string().regex(/^\d+$/).refine(pageWithinLimit).optional(),
  position: referenceIdSchema.optional(),
});

export function parseSearchState(
  raw: Record<string, string | string[] | undefined>,
): SearchState | null {
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { q = "", type = "all", page, position } = parsed.data;
  if (position !== undefined && type === "position") return null;
  return {
    query: q.trim(),
    type: position === undefined ? type : "technique",
    page: page === undefined ? 0 : Number(page),
    positionId: position ?? null,
  };
}

export type CuratedVideo = {
  url: string;
  videoId: string;
  startSeconds: number;
};

function parseVideoAddress(input: string) {
  if (
    !/^https:\/\/(?:www\.youtube\.com|youtube\.com|youtu\.be)\//.test(input)
  ) {
    return null;
  }
  if (input.includes("#") || input.includes("\\")) return null;
  try {
    const parsed = new URL(input);
    return parsed;
  } catch {
    return null;
  }
}

function parseVideoId(parsed: URL, input: string) {
  const short = parsed.hostname === "youtu.be";
  if (!short && parsed.pathname !== "/watch") return null;
  const rawQuery = input.split("?")[1];
  const pairs = rawQuery === undefined ? [] : rawQuery.split("&");
  if (pairs.some((pair) => !/^(?:v=[A-Za-z0-9_-]{11}|t=\d+s?)$/.test(pair))) {
    return null;
  }
  const allowed = short ? ["t"] : ["v", "t"];
  if ([...parsed.searchParams.keys()].some((key) => !allowed.includes(key)))
    return null;
  if (new Set(parsed.searchParams.keys()).size !== parsed.searchParams.size)
    return null;
  const rawId = short ? parsed.pathname.slice(1) : parsed.searchParams.get("v");
  return rawId && /^[A-Za-z0-9_-]{11}$/.test(rawId) ? rawId : null;
}

function parseSeconds(value: string) {
  const seconds = Number.parseInt(value, 10);
  return Number.isSafeInteger(seconds) &&
    seconds <= referenceSearchLimits.videoSeconds
    ? seconds
    : null;
}

function parseTimeParts(value: string) {
  const parts = value.split(":");
  if (parts.length > 3) return null;
  if (!/^\d+$/.test(parts[0]) || !/^\d{2}$/.test(parts[1])) return null;
  if (parts.length === 3 && !/^\d{2}$/.test(parts[2])) return null;
  const numbers = parts.map(Number);
  if (numbers[1] > 59 || (numbers[2] ?? 0) > 59) return null;
  const seconds =
    parts.length === 2
      ? numbers[0] * 60 + numbers[1]
      : numbers[0] * 3_600 + numbers[1] * 60 + numbers[2];
  return seconds <= referenceSearchLimits.videoSeconds ? seconds : null;
}

function parseCuratorTime(value: number | string | undefined) {
  if (value === undefined) return null;
  if (typeof value === "string") return parseTimeParts(value);
  return Number.isInteger(value) &&
    value >= 0 &&
    value <= referenceSearchLimits.videoSeconds
    ? value
    : null;
}

export function parseCuratedVideoUrl(
  input: string,
  start?: number | string,
): CuratedVideo | null {
  const parsed = parseVideoAddress(input);
  if (parsed === null) return null;
  const rawId = parseVideoId(parsed, input);
  if (rawId === null) return null;
  const urlTime = parsed.searchParams.get("t");
  const urlSeconds = urlTime === null ? null : parseSeconds(urlTime);
  if (urlTime !== null && urlSeconds === null) return null;
  const explicitSeconds = parseCuratorTime(start);
  if (start !== undefined && explicitSeconds === null) return null;
  if (
    urlSeconds !== null &&
    explicitSeconds !== null &&
    urlSeconds !== explicitSeconds
  ) {
    return null;
  }
  return {
    url: `https://www.youtube.com/watch?v=${rawId}`,
    videoId: rawId,
    startSeconds: explicitSeconds ?? urlSeconds ?? 0,
  };
}

export function videoHref(url: string, startSeconds: number) {
  const parsed = parseCuratedVideoUrl(url, startSeconds);
  return parsed === null ? null : `${parsed.url}&t=${parsed.startSeconds}s`;
}

export function formatStartTime(seconds: number) {
  if (
    !Number.isInteger(seconds) ||
    seconds < 0 ||
    seconds > referenceSearchLimits.videoSeconds
  ) {
    return null;
  }
  const second = String(seconds % 60).padStart(2, "0");
  const minute = Math.floor(seconds / 60) % 60;
  const hour = Math.floor(seconds / 3_600);
  return hour === 0
    ? `${minute}:${second}`
    : `${hour}:${String(minute).padStart(2, "0")}:${second}`;
}
