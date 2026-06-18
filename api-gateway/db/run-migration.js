import "dotenv/config";
import fs from "fs";
import pg from "pg";

const { Pool } = pg;
const sqlFile = process.argv[2];

if (!sqlFile) {
  console.error("Usage: node db/run-migration.js <path-to-sql-file>");
  process.exit(1);
}

const sql = fs.readFileSync(sqlFile, "utf-8");
const pool = new Pool();

try {
  await pool.query(sql);
  console.log(`[migrate] ✔ Executed ${sqlFile} successfully`);
} catch (err) {
  console.error(`[migrate] ✘ Failed:`, err.message);
  process.exit(1);
} finally {
  await pool.end();
}
