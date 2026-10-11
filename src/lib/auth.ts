
import "server-only";

import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";

export const SESSION_COOKIE = "tenantflow_session";

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

export interface AuthUser {
  userId: string;
  tenantId: string;
  fullName: string;
  email: string;
  role: string;
}

export function hashToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function createSession(
  userId: string,
  tenantId: string
) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  const expiresAt = new Date(
    Date.now() + SESSION_DURATION
  );

  await pool.query(
    `SELECT public.create_auth_session(
      $1::uuid,
      $2::uuid,
      $3::text,
      $4::timestamptz
    )`,
    [userId, tenantId, tokenHash, expiresAt]
  );

  return {
    token,
    expiresAt,
  };
}

export async function getCurrentUser():
  Promise<AuthUser | null> {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  const tokenHash = hashToken(token);

  const result = await pool.query<{
    user_id: string;
    tenant_id: string;
    full_name: string;
    email: string;
    role_name: string;
  }>(
    `SELECT * FROM public.get_auth_session($1::text)`,
    [tokenHash]
  );

  const user = result.rows[0];

  if (!user) {
    return null;
  }

  return {
    userId: user.user_id,
    tenantId: user.tenant_id,
    fullName: user.full_name,
    email: user.email,
    role: user.role_name,
  };
}
