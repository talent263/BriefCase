import "server-only";

import { createHash } from "node:crypto";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { DocumentData } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { signSessionToken } from "@/lib/auth/session";
import { isUserRole } from "@/lib/auth/roles";
import type { UserRole } from "@/types/models";

interface ProvisionedUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  firmId: string;
  role: UserRole;
}

function safeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function inviteDocumentId(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex");
}

function roleFromData(data: DocumentData | undefined): UserRole | null {
  const role = data?.role;
  return isUserRole(role) ? role : null;
}

function userFromData(uid: string, email: string, data: DocumentData | undefined, token: DecodedIdToken): ProvisionedUser | null {
  const role = roleFromData(data);
  if (!data || typeof data.firmId !== "string" || !role) return null;
  return {
    uid,
    email,
    displayName: safeString(token.name, email.split("@")[0] ?? "Briefcase user"),
    photoURL: typeof token.picture === "string" ? token.picture : null,
    firmId: data.firmId,
    role,
  };
}

export async function provisionAndCreateSession(idToken: string): Promise<string> {
  const auth = getAdminAuth();
  const db = getAdminDb();
  const decoded = await auth.verifyIdToken(idToken, true);
  if (decoded.firebase?.sign_in_provider !== "google.com") {
    throw new Error("Sign in with Google to access Briefcase.");
  }
  const email = typeof decoded.email === "string" ? decoded.email.trim().toLowerCase() : "";
  if (!email || decoded.email_verified !== true) {
    throw new Error("A verified Google account is required.");
  }

  const userRef = db.collection("users").doc(decoded.uid);
  const teamRef = db.collection("team").doc(decoded.uid);
  const inviteRef = db.collection("teamInvites").doc(inviteDocumentId(email));
  const userSnapshot = await userRef.get();
  let provisioned = userFromData(decoded.uid, email, userSnapshot.data(), decoded);

  if (!provisioned) {
    const ageSeconds = Math.floor(Date.now() / 1000) - decoded.auth_time;
    if (ageSeconds > 5 * 60) throw new Error("Please sign in again to finish workspace setup.");

    provisioned = await db.runTransaction(async (transaction) => {
      const currentUser = await transaction.get(userRef);
      if (currentUser.exists) {
        const existing = userFromData(decoded.uid, email, currentUser.data(), decoded);
        if (!existing) throw new Error("Workspace profile is incomplete.");
        return existing;
      }

      const inviteSnapshot = await transaction.get(inviteRef);
      const invite = inviteSnapshot.data();
      const invitedRole = roleFromData(invite);
      const firmId = typeof invite?.firmId === "string" ? invite.firmId : `firm_${decoded.uid}`;
      const role: UserRole = invitedRole && invite?.email === email ? invitedRole : "administrator";
      const now = new Date().toISOString();
      const created: ProvisionedUser = {
        uid: decoded.uid,
        email,
        displayName: safeString(decoded.name, email.split("@")[0] ?? "Briefcase user"),
        photoURL: typeof decoded.picture === "string" ? decoded.picture : null,
        firmId,
        role,
      };

      if (role === "administrator" && !inviteSnapshot.exists) {
        transaction.set(db.collection("firms").doc(firmId), {
          name: "Moyo & Partners",
          address: "Harare, Zimbabwe",
          phone: "",
          email,
          firmId,
          createdAt: now,
        });
      }

      transaction.set(userRef, { ...created, createdAt: now });
      transaction.set(teamRef, { ...created, status: "active", createdAt: now });
      if (inviteSnapshot.exists && invitedRole) transaction.delete(inviteRef);
      return created;
    });
  }

  const adminUser = await auth.getUser(decoded.uid);
  const nextClaims: Record<string, unknown> = {
    ...adminUser.customClaims,
    firmId: provisioned.firmId,
    role: provisioned.role,
  };
  if (adminUser.customClaims?.firmId !== provisioned.firmId || adminUser.customClaims?.role !== provisioned.role) {
    await auth.setCustomUserClaims(decoded.uid, nextClaims);
  }

  return signSessionToken(provisioned);
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function invitationDocumentId(email: string): string {
  return inviteDocumentId(email);
}
