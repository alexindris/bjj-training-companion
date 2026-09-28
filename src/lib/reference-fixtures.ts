import { z } from "zod";
import { parseCuratedVideoUrl } from "./reference-validation";

const techniqueProvenance =
  "Original BJJ Training Companion milestone 3 fixture; no imported corpus.";
const positionIds = new Set([
  "closed-guard",
  "open-guard",
  "side-control",
  "top-half-guard",
]);

export const referenceTechniqueFixtures = [
  {
    id: "standing-closed-guard-opening",
    positionId: "closed-guard",
    title: "Standing closed guard opening",
    description:
      "A reference topic for opening closed guard from a standing posture. Record your own reminder about balance and the first control you want to establish.",
    provenance: techniqueProvenance,
  },
  {
    id: "outside-open-guard-pass",
    positionId: "open-guard",
    title: "Outside open guard pass",
    description:
      "A reference topic for moving around the legs in open guard. Use this entry to keep a personal cue about controlling distance before settling beside the torso.",
    provenance: techniqueProvenance,
  },
  {
    id: "side-control-space-recovery",
    positionId: "side-control",
    title: "Side control space recovery",
    description:
      "A reference topic for creating room under side control before recovering a guard. Keep your own cue about the first frame or movement you practiced.",
    provenance: techniqueProvenance,
  },
  {
    id: "half-guard-knee-cut-pass",
    positionId: "top-half-guard",
    title: "Half guard knee cut pass",
    description:
      "A reference topic for clearing the trapped leg with a knee cut from top half guard. Keep a personal reminder about the control you practiced before completing the pass.",
    provenance: techniqueProvenance,
  },
] as const;

export const referenceVideoFixtures: readonly ReferenceVideoFixture[] = [
  {
    id: "closed-guard-opening-chewjitsu",
    techniqueId: "standing-closed-guard-opening",
    url: "https://www.youtube.com/watch?v=3B0w4zb51Mk",
    label: "Standing closed guard opening",
    sourceName: "Chewjitsu",
    sourceTitle: "How To Break Closed Guard Without Getting Swept",
    startSeconds: 150,
    momentLabel: "Executing the guard break",
    provenance:
      "External Chewjitsu YouTube creator video; linked only. Reviewed in the provider player on 2026-09-28.",
    reviewedOn: "2026-09-28",
  },
  {
    id: "side-control-recovery-chewjitsu",
    techniqueId: "side-control-space-recovery",
    url: "https://www.youtube.com/watch?v=VBT67Grv28k",
    label: "Side control escape example",
    sourceName: "Chewjitsu",
    sourceTitle: "Side control escape against tight top pressure",
    startSeconds: 75,
    momentLabel: "Framing under tight side control",
    provenance:
      "External Chewjitsu YouTube creator video; linked only. Reviewed in the provider player on 2026-09-28.",
    reviewedOn: "2026-09-28",
  },
];

export type ReferenceVideoFixture = {
  id: string;
  techniqueId: string;
  url: string;
  label: string;
  sourceName: string;
  sourceTitle: string;
  startSeconds: number;
  momentLabel: string;
  provenance: string;
  reviewedOn: string;
};

function hasNonblankText(value: string) {
  return value.trim().length > 0;
}

const boundedText = (maximum: number) =>
  z.string().max(maximum).refine(hasNonblankText);

const techniqueFixtureSchema = z.strictObject({
  id: boundedText(200),
  positionId: boundedText(200),
  title: boundedText(200),
  description: boundedText(2_000),
  provenance: boundedText(1_000),
});

const videoFixtureSchema = z.strictObject({
  id: boundedText(200),
  techniqueId: boundedText(200),
  url: boundedText(2_048),
  label: boundedText(200),
  sourceName: boundedText(200),
  sourceTitle: boundedText(200),
  startSeconds: z.number().int().min(0).max(21_600),
  momentLabel: boundedText(200),
  provenance: boundedText(1_000),
  reviewedOn: z.iso.date(),
});

export function validateReferenceFixtures(
  techniques: readonly unknown[],
  videos: readonly unknown[],
) {
  const validTechniques = techniques.map((item) =>
    techniqueFixtureSchema.parse(item),
  );
  const validVideos = videos.map((item) => videoFixtureSchema.parse(item));
  const ids = new Set(validTechniques.map((item) => item.id));
  if (validTechniques.length !== ids.size)
    throw new Error("Duplicate technique fixture ID");
  if (validTechniques.some((item) => !positionIds.has(item.positionId))) {
    throw new Error("Unknown position fixture ID");
  }
  if (validVideos.length !== new Set(validVideos.map((item) => item.id)).size) {
    throw new Error("Duplicate video fixture ID");
  }
  for (const video of validVideos) {
    if (!ids.has(video.techniqueId))
      throw new Error("Unknown technique fixture ID");
    const parsed = parseCuratedVideoUrl(video.url, video.startSeconds);
    if (parsed === null || parsed.url !== video.url) {
      throw new Error("Invalid canonical video fixture URL");
    }
  }
  return { techniques: validTechniques, videos: validVideos };
}
