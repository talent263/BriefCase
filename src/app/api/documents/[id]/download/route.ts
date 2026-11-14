import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getAdminBucket, getAdminDb } from "@/lib/firebase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  try {
    const session = await verifySessionToken(token);
    const { id } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(id)) return NextResponse.json({ error: "Invalid document." }, { status: 400 });
    const snapshot = await getAdminDb().collection("documents").doc(id).get();
    if (!snapshot.exists || snapshot.get("firmId") !== session.firmId) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const path: unknown = snapshot.get("storagePath");
    if (typeof path !== "string" || !path.startsWith(`firms/${session.firmId}/documents/`)) {
      return NextResponse.json({ error: "Document file is unavailable." }, { status: 404 });
    }
    const [url] = await getAdminBucket().file(path).getSignedUrl({
      action: "read",
      expires: Date.now() + 5 * 60 * 1000,
    });
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Could not retrieve document." }, { status: 401 });
  }
}
