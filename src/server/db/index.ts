import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env";
import * as schema from "./schema";

// One pool per process; survive Next.js hot reloads in dev.
const globalForDb = globalThis as unknown as { owlrndPool?: Pool };

function pool(): Pool {
  globalForDb.owlrndPool ??= new Pool({ connectionString: env().DATABASE_URL, max: 10 });
  return globalForDb.owlrndPool;
}

export const db = drizzle({ client: pool(), schema });
export type Db = typeof db;
export { schema };
