/**
 * Applies database migrations in production (inside the Docker image, before a new version starts):
 *   node migrate.cjs
 * Bundled into one file at image build time, so it needs nothing from node_modules. Reads DATABASE_URL.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: process.env.MIGRATIONS_DIR ?? "./migrations" });
    console.log("[owlrnd migrate] database is up to date");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[owlrnd migrate] failed", err);
  process.exit(1);
});
