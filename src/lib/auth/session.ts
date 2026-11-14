import "server-only";

import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import type { JWTPayload } from "jose";
import type { UserRole } from "@/types/models";
import { isUserRole } from "@/lib/auth/roles";

export const SESSION_COOKIE = "briefcase_session";
export const SESSION_MAX_AGE_SECONDS = 2 * 60 * 60;

export interface SessionIdentity {
  uid: string;
  email: string;
  firmId: string;
  role: UserRole;
}

export interface SessionClaims extends JWTPayload, SessionIdentity {}

function signingKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(claims: SessionIdentity): Promise<string> {
  return new SignJWT({ uid: claims.uid, email: claims.email, firmId: claims.firmId, role: claims.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.uid)
    .setIssuer("briefcase")
    .setAudience("briefcase-web")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(signingKey());
}

export async function verifySessionToken(token: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, signingKey(), {
    algorithms: ["HS256"],
    issuer: "briefcase",
    audience: "briefcase-web",
  });
  if (
    typeof payload.sub !== "string" ||
    typeof payload.uid !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.firmId !== "string" ||
    !isUserRole(payload.role)
  ) {
    throw new Error("Invalid session claims.");
  }
  if (payload.uid !== payload.sub) throw new Error("Invalid session subject.");
  return { ...payload, uid: payload.uid, email: payload.email, firmId: payload.firmId, role: payload.role };
}
