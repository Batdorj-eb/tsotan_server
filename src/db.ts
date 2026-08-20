import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export function publicFileUrl(stored: string | null | undefined) {
  if (!stored) return "";
  if (stored.startsWith("http")) return stored;
  return `${config.publicUrl}${stored.startsWith("/") ? "" : "/"}${stored}`;
}

const here = path.dirname(fileURLToPath(import.meta.url));

export function schemaSql() {
  return fs.readFileSync(path.join(here, "db", "schema.sql"), "utf8");
}
