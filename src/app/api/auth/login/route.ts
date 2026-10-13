
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { pool } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createSession,
  SESSION_COOKIE,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validations/login";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function POST(request: Request) {
  try {
    // Basic same-origin protection for browser requests.
    const origin = request.headers.get("origin");

    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const rawBody = await request.text();

    if (rawBody.length > 16_384) {
      return NextResponse.json(
        { error: "Request too large" },
        { status: 413, headers: NO_STORE_HEADERS }
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid login input",
          details: parsed.error.flatten(),
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const { organizationSlug, email, password } =
      parsed.data;

    // Rate-limit BEFORE looking up the user or
    // verifying the password.
    const allowed = await checkRateLimit({
      action: "login",
      organizationSlug,
      email,
    });

    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "Too many login attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            ...NO_STORE_HEADERS,
            "Retry-After": "900",
          },
        }
      );
    }

    const result = await pool.query<{
      user_id: string;
      tenant_id: string;
      full_name: string;
      password_hash: string;
      role_name: string;
    }>(
      `SELECT * FROM public.find_login_user(
        $1::text, $2::text
      )`,
      [organizationSlug, email]
    );

    const user = result.rows[0];

    // Keep a dummy bcrypt comparison for accounts
    // that do not exist.
    const validPassword = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(
          password,
          "$2b$12$C6UzMDM.H6dfI/f/IKcEeO9d8yPxkvB9AW3iA5e9nKS7S4X9N6x1O"
        );

    if (!user || !validPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const session = await createSession(
      user.user_id,
      user.tenant_id
    );

    const response = NextResponse.json({
      message: "Login successful",
      user: {
        id: user.user_id,
        fullName: user.full_name,
        email,
        role: user.role_name,
        tenantId: user.tenant_id,
      },
    });

    response.cookies.set(
      SESSION_COOKIE,
      session.token,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: session.expiresAt,
      }
    );

    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    console.error(
      "Login error:",
      error instanceof Error ? error.name : "UnknownError"
    );

    return NextResponse.json(
      { error: "Login temporarily unavailable" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}
