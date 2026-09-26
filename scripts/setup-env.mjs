import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const template = await readFile(
  new URL("../.env.example", import.meta.url),
  "utf8",
);
const contents = template
  .replace(
    "replace-with-a-random-secret-at-least-32-characters",
    randomBytes(32).toString("base64"),
  )
  .replace(
    "replace-with-a-local-development-password",
    randomBytes(18).toString("base64url"),
  );
try {
  await writeFile(new URL("../.env", import.meta.url), contents, {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    "Created .env with random local secrets. Use DEV_USER_PASSWORD for both synthetic accounts.",
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(".env already exists; preserved your settings.");
}
