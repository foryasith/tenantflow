
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

import { pool } from "@/lib/db";
import { registerSchema } from "@/lib/validations/register";

export async function POST(request: Request) {
  try {
    const contentLength = Number(
      request.headers.get("content-length") ?? 0
    );

    if (contentLength > 16_384) {
      return NextResponse.json(
        { error: "Request too large" },
        { status: 413 }
      );
    }

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

    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      organizationName,
      fullName,
      email,
      password,
    } = parsed.data;

    const baseSlug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "organization";

    const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query<{
      organization_id: string;
      owner_id: string;
    }>(
      `SELECT organization_id, owner_id
       FROM public.register_organization(
         $1, $2, $3, $4, $5
       )`,
      [
        organizationName,
        slug,
        fullName,
        email,
        passwordHash,
      ]
    );

    const created = result.rows[0];

    if (!created) {
      throw new Error("Registration returned no result");
    }

    return NextResponse.json(
      {
        message: "Organization registered successfully",
        organization: {
          id: created.organization_id,
          name: organizationName,
          slug,
        },
        owner: {
          id: created.owner_id,
          fullName,
          email,
          role: "OWNER",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration failed:", error);

    return NextResponse.json(
      { error: "Unable to register organization" },
      { status: 500 }
    );
  }
}
