import "dotenv/config";
import { eq } from "drizzle-orm";
import { assertLocalSeed } from "./seed-guard";
import {
  referenceTechniqueFixtures,
  referenceVideoFixtures,
  validateReferenceFixtures,
} from "../src/lib/reference-fixtures";

async function main() {
  const password = assertLocalSeed(process.env);
  const fixtures = validateReferenceFixtures(
    referenceTechniqueFixtures,
    referenceVideoFixtures,
  );
  const { db, pool } = await import("../src/db");
  const { auth } = await import("../src/lib/auth");
  const {
    user,
    profiles,
    referencePositions,
    referenceTechniques,
    referenceVideos,
  } = await import("../src/db/schema");
  try {
    for (const account of [
      {
        name: "Sam Demo",
        email: "sam@example.test",
        locale: "en",
        timezone: "UTC",
      },
      {
        name: "Jamie Demo",
        email: "jamie@example.test",
        locale: "es",
        timezone: "Europe/Madrid",
      },
    ]) {
      const [existing] = await db
        .select()
        .from(user)
        .where(eq(user.email, account.email));
      if (existing) {
        console.log(`Kept existing development user: ${account.email}`);
        continue;
      }
      const result = await auth.api.signUpEmail({
        body: { name: account.name, email: account.email, password },
      });
      await db
        .insert(profiles)
        .values({
          userId: result.user.id,
          locale: account.locale,
          timezone: account.timezone,
        })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: { locale: account.locale, timezone: account.timezone },
        });
      console.log(`Created development user: ${account.email}`);
    }
    await db.transaction(async (tx) => {
      await tx
        .insert(referencePositions)
        .values([
          {
            id: "closed-guard",
            title: "Closed guard",
            description:
              "The bottom player wraps their legs around the top player and connects their ankles. This is a starting situation for studying guard opening.",
            provenance:
              "Original BJJ Training Companion foundation fixture; no imported corpus.",
          },
          {
            id: "open-guard",
            title: "Open guard",
            description:
              "The bottom player uses their legs and grips without keeping their ankles connected. Different controls lead to different passing situations.",
            provenance:
              "Original BJJ Training Companion foundation fixture; no imported corpus.",
          },
          {
            id: "side-control",
            title: "Side control",
            description:
              "The top player is beside the bottom player’s torso after moving past the legs. Consolidating this position is a separate focus from the pass itself.",
            provenance:
              "Original BJJ Training Companion foundation fixture; no imported corpus.",
          },
          {
            id: "top-half-guard",
            title: "Top half guard",
            description:
              "The top player has one leg caught between the bottom player’s legs. This is a distinct starting situation for a passing goal.",
            provenance:
              "Original BJJ Training Companion foundation fixture; no imported corpus.",
          },
        ])
        .onConflictDoNothing();
      await tx
        .insert(referenceTechniques)
        .values(fixtures.techniques)
        .onConflictDoNothing();
      await tx
        .insert(referenceVideos)
        .values(fixtures.videos)
        .onConflictDoNothing();
    });
    console.log(
      "English reference fixtures ready. Re-running the seed preserves existing users, passwords, and preferences.",
    );
  } finally {
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seeding failed.");
  process.exitCode = 1;
});
