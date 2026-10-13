
import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";
import { forgotPasswordSchema } from "@/lib/validations/password-reset";

const GENERIC_MESSAGE =
  "If this account exists and email delivery is available, you will receive password reset instructions.";

const HEADERS = {
  "Cache-Control": "no-store",
};

function genericResponse() {
  return NextResponse.json(
    { message: GENERIC_MESSAGE },
    { status: 200, headers: HEADERS }
  );
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");

    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403, headers: HEADERS }
      );
    }

    const rawBody = await request.text();

    if (rawBody.length > 4096) {
      return NextResponse.json(
        { error: "Request too large" },
        { status: 413, headers: HEADERS }
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400, headers: HEADERS }
      );
    }

    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400, headers: HEADERS }
      );
    }

    const { organizationSlug, email } = parsed.data;

    // Limit password reset requests per account.
    const allowed = await checkRateLimit({
      action: "forgot-password",
      organizationSlug,
      email,
    });

    // Keep response generic to avoid exposing accounts.
    if (!allowed) {
      return genericResponse();
    }

    const token = randomBytes(32).toString("hex");

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const result = await pool.query<{
      issue_password_reset: boolean;
    }>(
      `SELECT public.issue_password_reset(
        $1::text,
        $2::text,
        $3::text
      )`,
      [organizationSlug, email, tokenHash]
    );

    const accountExists =
      result.rows[0]?.issue_password_reset === true;

    if (accountExists) {
      try {
        await sendPasswordResetEmail(email, token);
      } catch (error) {
        // Do not expose account existence through the API.
        // Log only a sanitized error category.
        console.error(
          "Password reset email delivery failed:",
          error instanceof Error
            ? error.name
            : "UnknownError"
        );
      }
    }

    return genericResponse();
  } catch (error) {
    console.error(
      "Password reset service error:",
      error instanceof Error ? error.name : "UnknownError"
    );

    return NextResponse.json(
      {
        error: "Password reset service temporarily unavailable",
      },
      { status: 503, headers: HEADERS }
    );
  }
}
