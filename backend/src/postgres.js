import pkg from 'pg';

const { Pool } = pkg;

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

export async function closePool() {
  if (pool) await pool.end();
}
