
import { Pool, type PoolClient } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

const globalForDb = globalThis as typeof globalThis & {
  pgPool?: Pool;
};

export const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

export async function withTenant<T>(
  verifiedTenantId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.tenant_id', $1, true)",
      [verifiedTenantId]
    );

    const result = await callback(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
