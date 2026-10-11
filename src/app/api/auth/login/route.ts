
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { pool } from "@/lib/db";
import {
  createSession,
  SESSION_COOKIE,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validations/login";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    if (rawBody.length > 16_384) {
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

    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid login input",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { organizationSlug, email, password } =
      parsed.data;

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

    const validPassword = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(
          password,
          "$2b$12$C6UzMDM.H6dfI/f/IKcEeO9d8yPxkvB9AW3iA5e9nKS7S4X9N6x1O"
        );

    if (!user || !validPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
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
    console.error("Login error:", error);

    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
