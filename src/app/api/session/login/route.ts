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
    if (!parsed.success) return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400 });

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sign in.";
    const status = message.includes("sign in again") || message.includes("verified Google") || message.includes("Sign in with Google") ? 401 : 503;
    return NextResponse.json({ error: status === 401 ? message : "Sign-in service is unavailable. Check Firebase server configuration." }, { status });
  }
}
