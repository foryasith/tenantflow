
import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  // Wait for an actual incoming request.
  await connection();

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        user,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Session verification failed:", error);

    return NextResponse.json(
      { error: "Unable to verify session" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
