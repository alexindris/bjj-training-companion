import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readEnv } from "../lib/env";
import * as schema from "./schema";

const globalDb = globalThis as unknown as { bjjPool?: Pool };
export const pool =
  globalDb.bjjPool ??
  new Pool({ connectionString: readEnv().DATABASE_URL, max: 5 });
if (process.env.NODE_ENV !== "production") globalDb.bjjPool = pool;
export const db = drizzle(pool, { schema });
