import "dotenv/config";

// This command intentionally serves the built application only on loopback.
process.env.HOSTNAME = "127.0.0.1";
process.env.PORT ??= "3000";
await import("../.next/standalone/server.js");
