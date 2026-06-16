/**
 * migrate.js — Sequential SQL migration runner.
 *
 * - Reads numbered .sql files from db/migrations/ in alphabetical order.
 * - Creates schema_migrations tracking table on first run.
 * - Skips already-applied migrations (by file name).
 * - Runs each unapplied migration inside a transaction (BEGIN/COMMIT/ROLLBACK).
 * - Files starting with `-- NO TRANSACTION` are executed statement-by-statement
 *   outside of a transaction (required for CREATE INDEX CONCURRENTLY).
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

const pool = new Pool({
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id     SERIAL       PRIMARY KEY,
      name   VARCHAR(255) NOT NULL UNIQUE,
      run_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedMigrations(client) {
  const result = await client.query("SELECT name FROM schema_migrations ORDER BY name");
  return new Set(result.rows.map((r) => r.name));
}

function splitStatements(sql) {
  // Splits on `;` while respecting dollar-quoted strings ($$...$$).
  const stmts = [];
  let current = "";
  let inDollarQuote = false;
  let dollarTag = "";

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    current += ch;

    if (!inDollarQuote && ch === "$") {
      // Detect start of dollar-quote tag: $tag$ or $$
      const rest = sql.slice(i);
      const match = rest.match(/^\$([^$]*)\$/);
      if (match) {
        dollarTag = match[0];
        inDollarQuote = true;
        current += rest.slice(1, dollarTag.length);
        i += dollarTag.length - 1;
      }
    } else if (inDollarQuote && sql.slice(i).startsWith(dollarTag)) {
      current += sql.slice(i + 1, i + dollarTag.length);
      i += dollarTag.length - 1;
      inDollarQuote = false;
      dollarTag = "";
    } else if (!inDollarQuote && ch === ";") {
      const stmt = current.trim().slice(0, -1).trim(); // strip trailing ;
      if (stmt) stmts.push(stmt);
      current = "";
    }
  }
  const remainder = current.trim();
  if (remainder) stmts.push(remainder);
  return stmts;
}

async function runMigration(client, name, sql, noTransaction) {
  if (noTransaction) {
    // Execute each statement individually, outside any transaction.
    const stmts = splitStatements(sql.replace(/^-- NO TRANSACTION\s*/i, ""));
    for (const stmt of stmts) {
      if (stmt.trim()) {
        await pool.query(stmt); // use pool, not client, to ensure no implicit tx
      }
    }
    await pool.query(
      "INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
      [name]
    );
    return;
  }

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
      [name]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function migrate() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await appliedMigrations(client);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] ✔ skip  ${file}`);
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, "utf8");
      const noTransaction = /^--\s*NO TRANSACTION/i.test(sql.trim());

      console.log(`[migrate] ▶ apply ${file}${noTransaction ? " (no-tx)" : ""}`);
      await runMigration(client, file, sql, noTransaction);
      console.log(`[migrate] ✔ done  ${file}`);
    }

    console.log("[migrate] All migrations applied.");
  } finally {
    client.release();
    await pool.end();
  }
}

// Allow direct execution: `node db/migrate.js`
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrate().catch((err) => {
    console.error("[migrate] Fatal:", err.message);
    process.exit(1);
  });
}
