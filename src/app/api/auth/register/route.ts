
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

import { pool } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validations/register";

const NO_STORE = {
  "Cache-Control": "no-store",
};

export async function POST(request: Request) {
  try {
    // Prevent cross-origin browser requests.
    const origin = request.headers.get("origin");
    const expectedOrigin = new URL(request.url).origin;

    if (origin && origin !== expectedOrigin) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403, headers: NO_STORE }
      );
    }

    // Check the declared body length.
    const contentLength = Number(
      request.headers.get("content-length") ?? 0
    );

    if (contentLength > 16_384) {
      return NextResponse.json(
        { error: "Request too large" },
        { status: 413, headers: NO_STORE }
      );
    }

    // Restrict the actual request body too.
    const rawBody = await request.text();

    if (rawBody.length > 16_384) {
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

    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400, headers: NO_STORE }
      );
    }

    const {
      organizationName,
      fullName,
      email,
      password,
    } = parsed.data;

    // Registration does not have an existing tenant slug.
    // Use a constant namespace and normalized email.
    const allowed = await checkRateLimit({
      action: "register",
      organizationSlug: "new-organization",
      email,
    });

    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "Too many registration attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            ...NO_STORE,
            "Retry-After": "3600",
          },
        }
      );
    }

    const baseSlug =
      organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "organization";

    const slug =
      `${baseSlug}-${randomUUID().slice(0, 8)}`;

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
      throw new Error(
        "Registration returned no result"
      );
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
      { status: 201, headers: NO_STORE }
    );
  } catch (error) {
    // Keep internal database errors away from clients.
    console.error(
      "Registration failed:",
      error instanceof Error ? error.name : "UnknownError"
    );

    return NextResponse.json(
      { error: "Unable to register organization" },
      { status: 500, headers: NO_STORE }
    );
  }
}
