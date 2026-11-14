import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { isSameOrigin, provisionAndCreateSession } from "@/lib/auth/provision";

const payloadSchema = z.object({ idToken: z.string().min(100).max(10000) });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

  try {
    const payload: unknown = await request.json();
    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success) return NextResponse.json({ error: "Invalid session request." }, { status: 400 });

    const token = await provisionAndCreateSession(parsed.data.idToken);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch {
    const response = NextResponse.json({ error: "Session could not be refreshed." }, { status: 401 });
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }
}
