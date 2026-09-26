export function assertLocalSeed(
  environment: Record<string, string | undefined>,
) {
  if (
    environment.NODE_ENV === "production" ||
    environment.ALLOW_DEV_SEED !== "true"
  ) {
    throw new Error(
      "Development seeding requires ALLOW_DEV_SEED=true and a non-production environment.",
    );
  }
  const url = new URL(environment.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error(
      "Development seeding is restricted to a loopback PostgreSQL database.",
    );
  }
  const password = environment.DEV_USER_PASSWORD ?? "";
  if (
    password.length < 12 ||
    password.length > 128 ||
    password.startsWith("replace-")
  ) {
    throw new Error(
      "Set DEV_USER_PASSWORD to a local-only password of 12–128 characters.",
    );
  }
  return password;
}
