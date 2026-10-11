
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(
      "SELECT NOW() AS server_time"
    );

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      timestamp: result.rows[0].server_time,
    });
  } catch (error) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        database: "disconnected",
      },
      { status: 503 }
    );
  }
}
