import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { invitationDocumentId, isSameOrigin } from "@/lib/auth/provision";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { isManagementRole } from "@/lib/auth/roles";
import { getAdminDb } from "@/lib/firebase/admin";
import { inviteSchema } from "@/lib/validation";

const inviteRequestSchema = inviteSchema;

async function getSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!isManagementRole(session.role)) return NextResponse.json({ error: "You cannot manage the team." }, { status: 403 });

  try {
    const snapshot = await getAdminDb().collection("teamInvites").where("firmId", "==", session.firmId).get();
    const invitations = snapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        email: typeof data.email === "string" ? data.email : "",
        role: data.role,
        createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
      };
    });
    return NextResponse.json({ invitations });
  } catch {
    return NextResponse.json({ error: "Could not load pending invitations." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!isManagementRole(session.role)) return NextResponse.json({ error: "You cannot manage the team." }, { status: 403 });

  try {
    const body: unknown = await request.json();
    const parsed = inviteRequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and role." }, { status: 400 });
    if (parsed.data.email.toLowerCase() === session.email.toLowerCase()) {
      return NextResponse.json({ error: "You are already a member of this workspace." }, { status: 409 });
    }

    const db = getAdminDb();
    const inviteId = invitationDocumentId(parsed.data.email);
    const existingUser = await db.collection("users").where("email", "==", parsed.data.email.toLowerCase()).limit(1).get();
    if (!existingUser.empty) {
      const existingFirmId: unknown = existingUser.docs[0]?.get("firmId");
      if (existingFirmId === session.firmId) {
        return NextResponse.json({ error: "That person is already in your workspace." }, { status: 409 });
      }
      return NextResponse.json({ error: "That account already belongs to another workspace." }, { status: 409 });
    }

    await db.collection("teamInvites").doc(inviteId).set({
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      firmId: session.firmId,
      createdBy: session.uid,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const issue = error instanceof z.ZodError ? "Enter a valid invitation." : "Could not save the invitation.";
    return NextResponse.json({ error: issue }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!isManagementRole(session.role)) return NextResponse.json({ error: "You cannot manage the team." }, { status: 403 });

  try {
    const body: unknown = await request.json();
    const parsed = z.object({ id: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid invitation." }, { status: 400 });
    const inviteRef = getAdminDb().collection("teamInvites").doc(parsed.data.id);
    const invite = await inviteRef.get();
    if (!invite.exists || invite.get("firmId") !== session.firmId) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }
    await inviteRef.delete();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not cancel the invitation." }, { status: 503 });
  }
}
