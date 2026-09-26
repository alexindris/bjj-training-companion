import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z
    .url()
    .refine(
      (url) => ["postgres:", "postgresql:"].includes(new URL(url).protocol),
      "Use a PostgreSQL URL",
    ),
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .refine(
      (value) => !value.startsWith("replace-"),
      "Generate a local auth secret",
    ),
});

export function readEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    // Never include environment values or connection strings in errors.
    throw new Error(
      `Invalid environment: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}. See .env.example.`,
    );
  }
  return result.data;
}
