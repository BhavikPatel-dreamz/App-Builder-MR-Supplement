import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { kyselyAdapter } from "@hot-updater/server/adapters/kysely";

import { env } from "./env.server";

// Hosted Postgres (Neon free tier) rather than the embedded file-backed
// PGlite this server originally used: Vercel's filesystem is read-only apart
// from an ephemeral /tmp, so a disk-backed database would be discarded on
// every cold start and would not be shared between concurrent instances.
//
// max: 1 — each serverless instance gets its own Pool, so per-instance
// connections stay at one and Neon's pgbouncer endpoint does the real
// pooling. Module scope means warm invocations reuse the same pool.
//
// The provider stays "postgresql" (PGlite was genuine Postgres compiled to
// WASM), so @hot-updater/server's schema and migrations are unchanged.
const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 1,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 10000,
  allowExitOnIdle: true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = new Kysely<any>({
  dialect: new PostgresDialect({ pool }),
});

export const databaseAdapter = kyselyAdapter({
  db,
  provider: "postgresql",
});
