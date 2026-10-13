
import "server-only";

import { createHmac } from "node:crypto";
import { pool } from "@/lib/db";

type RateLimitAction = "login" | "forgot-password";

type RateLimitInput = {
  action: RateLimitAction;
  organizationSlug: string;
  email: string;
};

const LIMITS = {
  login: {
    maxAttempts: 5,
    windowSeconds: 15 * 60,
  },
  "forgot-password": {
    maxAttempts: 3,
    windowSeconds: 15 * 60,
  },
} as const;

export async function checkRateLimit({
  action,
  organizationSlug,
  email,
}: RateLimitInput): Promise<boolean> {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_RATE_LIMIT_SECRET is missing or too short"
    );
  }

  const normalizedSlug =
    organizationSlug.trim().toLowerCase();

  const normalizedEmail =
    email.trim().toLowerCase();

  const identity = JSON.stringify([
    action,
    normalizedSlug,
    normalizedEmail,
  ]);

  const rateKey = createHmac("sha256", secret)
    .update(identity)
    .digest("hex");

  const config = LIMITS[action];

  const result = await pool.query<{
    allowed: boolean;
  }>(
    `SELECT public.check_auth_rate_limit(
      $1::text,
      $2::integer,
      $3::integer
    ) AS allowed`,
    [
      rateKey,
      config.maxAttempts,
      config.windowSeconds,
    ]
  );

  return result.rows[0]?.allowed === true;
}
