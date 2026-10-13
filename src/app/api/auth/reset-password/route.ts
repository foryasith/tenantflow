
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/validations/password-reset";

const NO_STORE = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

export async function POST(request: Request) {
  try {
    // Reject requests from other browser origins.
    const origin = request.headers.get("origin");
    const expectedOrigin = new URL(request.url).origin;

    if (origin && origin !== expectedOrigin) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403, headers: NO_STORE }
      );
    }

    // Restrict request size.
    const rawBody = await request.text();

    if (rawBody.length > 4096) {
      return NextResponse.json(
        { error: "Request too large" },
        { status: 413, headers: NO_STORE }
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400, headers: NO_STORE }
      );
    }

    // Validate token and password.
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid token or password format" },
        { status: 400, headers: NO_STORE }
      );
    }

    const { token, password } = parsed.data;

    // Hash the new password with bcrypt.
    const passwordHash = await bcrypt.hash(password, 12);

    // Match the SHA-256 token hash stored in PostgreSQL.
    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    // The SQL function atomically:
    // 1. Checks token expiry and single-use status
    // 2. Updates the password hash
    // 3. Revokes all previous sessions
    // 4. Removes reset tokens
    const result = await pool.query<{
      consume_password_reset: boolean;
    }>(
      `SELECT public.consume_password_reset(
        $1::text,
        $2::text
      )`,
      [tokenHash, passwordHash]
    );

    const success =
      result.rows[0]?.consume_password_reset === true;

    if (!success) {
      return NextResponse.json(
        {
          error:
            "This reset link is invalid, expired, or already used. Request a new link.",
        },
        { status: 400, headers: NO_STORE }
      );
    }

    return NextResponse.json(
      {
        message:
          "Password updated successfully. Please log in with your new password.",
      },
      { status: 200, headers: NO_STORE }
    );
  } catch (error) {
    console.error(
      "Password reset failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to reset password right now" },
      { status: 503, headers: NO_STORE }
    );
  }
}
