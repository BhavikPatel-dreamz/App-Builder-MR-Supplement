// Imports the OTA table dumps in ./data/*.json into the hot-updater tables in
// DATABASE_URL. Run AFTER `npm run ota:migrate` has created the schema.
//
// Merge semantics: rows are inserted with ON CONFLICT (<pk>) DO NOTHING, so
// re-running never clobbers rows already present (e.g. bundles edited from the
// dashboard) — it only fills in what's missing. JSON columns (metadata,
// target_cohorts) are serialized explicitly; everything else is passed through.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const dataDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data",
);

// One entry per dump file: the table it loads and that table's primary key
// (used for the ON CONFLICT target). Columns are taken verbatim from each row's
// keys, so the JSON field names must match the table columns exactly.
const TABLES = [
  { file: "bundles.json", table: "bundles", pk: "id" },
  { file: "bundle_patches.json", table: "bundle_patches", pk: "id" },
  {
    file: "private_hot_updater_settings.json",
    table: "private_hot_updater_settings",
    pk: "key",
  },
];

// json/jsonb columns: pass a JSON string (null stays null) instead of letting
// node-pg turn a JS array into a Postgres array literal.
function encode(value) {
  return value !== null && typeof value === "object"
    ? JSON.stringify(value)
    : value;
}

async function importTable(pool, { file, table, pk }) {
  let rows;
  try {
    rows = JSON.parse(await readFile(path.join(dataDir, file), "utf8"));
  } catch (err) {
    console.warn(`[ota-import] skipping ${file}: ${err.message}`);
    return;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`[ota-import] ${table}: nothing to import (0 rows)`);
    return;
  }

  let inserted = 0;
  for (const row of rows) {
    const cols = Object.keys(row);
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const sql =
      `insert into "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) ` +
      `values (${placeholders.join(", ")}) ` +
      `on conflict ("${pk}") do nothing`;
    const res = await pool.query(sql, cols.map((c) => encode(row[c])));
    inserted += res.rowCount;
  }
  console.log(
    `[ota-import] ${table}: ${inserted} inserted, ${rows.length - inserted} already present`,
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — cannot import OTA data.");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    for (const spec of TABLES) {
      await importTable(pool, spec);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[ota-import] failed:", err);
  process.exit(1);
});
