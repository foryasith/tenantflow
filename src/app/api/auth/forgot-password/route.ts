
import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { forgotPasswordSchema } from "@/lib/validations/password-reset";

const GENERIC_MESSAGE =
  "If the account exists, a password reset email will be sent.";

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");

    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 }
      );
    }

    const rawBody = await request.text();

    if (rawBody.length > 4096) {
      return NextResponse.json(
        { error: "Request too large" },
        { status: 413 }
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }

    const { organizationSlug, email } = parsed.data;

    const token = randomBytes(32).toString("hex");

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const result = await pool.query<{
      issue_password_reset: boolean;
    }>(
      `SELECT public.issue_password_reset(
        $1::text, $2::text, $3::text
      )`,
      [organizationSlug, email, tokenHash]
    );

    const accountExists =
      result.rows[0]?.issue_password_reset === true;

    if (accountExists) {
      await sendPasswordResetEmail(email, token);
    }

    return NextResponse.json(
      { message: GENERIC_MESSAGE },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error(
      "Password reset request failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Password reset service unavailable" },
      { status: 503 }
    );
  }
}
