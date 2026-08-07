import pkg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pkg;
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaFile = path.resolve(backendRoot, 'sql/001_core_tables.sql');

let pool = null;

export function initializePool(databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
  });
  return pool;
}

export async function query(sql, params = []) {
  if (!pool) throw new Error('Database pool not initialized');
  return pool.query(sql, params);
}

export async function one(sql, params = []) {
  const result = await query(sql, params);
  return result.rows[0] ?? null;
}

export async function all(sql, params = []) {
  const result = await query(sql, params);
  return result.rows;
}

export async function initializeDatabaseSchema() {
  const schema = await fs.readFile(schemaFile, 'utf8');
  await query(schema);
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
