import { cp } from "node:fs/promises";

// Next's standalone server needs its static assets beside the generated server.
await cp(
  new URL("../.next/static", import.meta.url),
  new URL("../.next/standalone/.next/static", import.meta.url),
  { recursive: true },
);
try {
  await cp(
    new URL("../public", import.meta.url),
    new URL("../.next/standalone/public", import.meta.url),
    { recursive: true },
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
console.log("Standalone server and static assets ready for local review.");
