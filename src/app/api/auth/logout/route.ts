
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { pool } from "@/lib/db";
import {
  hashToken,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.json({
    message: "Logged out successfully",
  });

  response.headers.set("Cache-Control", "no-store");

  try {
    const origin = request.headers.get("origin");

    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "Invalid origin" },
        { status: 403 }
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (token && /^[a-f0-9]{64}$/.test(token)) {
      await pool.query(
        "SELECT public.revoke_auth_session($1::text)",
        [hashToken(token)]
      );
    }

    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Logout failed:", error);

    return NextResponse.json(
      { error: "Unable to log out" },
      { status: 500 }
    );
  }
}
