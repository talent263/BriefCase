"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { isFirebaseConfigured, getClientAuth } from "@/lib/firebase/client";
import { isUserRole } from "@/lib/auth/roles";
import { getLocalUser, signOutLocal, subscribeLocalAuth } from "@/lib/local-auth";
import { isLocalMode } from "@/lib/local-mode";
import type { WorkspaceUser } from "@/types/models";

type AuthStatus = "loading" | "ready" | "signed-out" | "unconfigured";

interface AuthContextValue {
  user: WorkspaceUser | null;
  status: AuthStatus;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function establishSession(firebaseUser: User): Promise<WorkspaceUser> {
  let token = await firebaseUser.getIdToken();
  const firstClaims = await firebaseUser.getIdTokenResult();
  const endpoint = typeof firstClaims.claims.firmId === "string" ? "/api/session/refresh" : "/api/session/login";
  let response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
    credentials: "same-origin",
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
      ? body.error
      : "Could not verify your workspace session.";
    throw new Error(message);
  }

  token = await firebaseUser.getIdToken(true);
  const claims = await firebaseUser.getIdTokenResult();
  if (typeof claims.claims.firmId !== "string" || typeof claims.claims.email !== "string" || !isUserRole(claims.claims.role)) {
    response = await fetch("/api/session/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("Workspace access could not be confirmed. Sign in again.");
    await firebaseUser.getIdToken(true);
  }

  const refreshed = await firebaseUser.getIdTokenResult();
  const firmId = refreshed.claims.firmId;
  const role = refreshed.claims.role;
  if (typeof firmId !== "string" || typeof refreshed.claims.email !== "string" || !isUserRole(role)) {
    throw new Error("Workspace profile is missing. Ask a firm administrator for help.");
  }

  return {
    uid: firebaseUser.uid,
    email: refreshed.claims.email,
    displayName: firebaseUser.displayName ?? firebaseUser.email?.split("@")[0] ?? "Briefcase user",
    photoURL: firebaseUser.photoURL,
    firmId,
    role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const localMode = isLocalMode();
  const [user, setUser] = useState<WorkspaceUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(localMode ? "loading" : isFirebaseConfigured() ? "loading" : "unconfigured");
  const [error, setError] = useState<string | null>(null);
  const firebaseUserRef = useRef<User | null>(null);

  useEffect(() => {
    if (localMode) {
      const sync = () => {
        const current = getLocalUser();
        setUser(current);
        setError(null);
        setStatus(current ? "ready" : "signed-out");
      };
      sync();
      return subscribeLocalAuth(sync);
    }

    if (!isFirebaseConfigured()) {
      setStatus("unconfigured");
      return;
    }

    let active = true;
    let currentUid = "";
    const unsubscribe = onAuthStateChanged(getClientAuth(), async (firebaseUser) => {
      if (!active) return;
      if (!firebaseUser) {
        firebaseUserRef.current = null;
        currentUid = "";
        setUser(null);
        setError(null);
        setStatus("signed-out");
        return;
      }
      firebaseUserRef.current = firebaseUser;
      if (currentUid === firebaseUser.uid) return;
      currentUid = firebaseUser.uid;
      setStatus("loading");
      setError(null);
      try {
        const workspaceUser = await establishSession(firebaseUser);
        if (active && currentUid === firebaseUser.uid) {
          setUser(workspaceUser);
          setStatus("ready");
        }
      } catch (cause) {
        if (active && currentUid === firebaseUser.uid) {
          setError(cause instanceof Error ? cause.message : "Sign-in could not be completed.");
          setUser(null);
          setStatus("signed-out");
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [localMode]);

  useEffect(() => {
    if (localMode || status !== "ready") return;
    const refresh = async () => {
      const firebaseUser = firebaseUserRef.current;
      if (!firebaseUser) return;
      try {
        const idToken = await firebaseUser.getIdToken();
        const response = await fetch("/api/session/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("Session refresh was rejected.");
      } catch {
        setError("Your session could not be refreshed. Please sign in again.");
        setUser(null);
        setStatus("signed-out");
      }
    };
    const interval = window.setInterval(() => void refresh(), 45 * 60 * 1000);
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [localMode, status]);

  const signOut = useCallback(async () => {
    if (localMode) {
      signOutLocal();
    } else if (isFirebaseConfigured()) {
      await fetch("/api/session/logout", { method: "POST", credentials: "same-origin" });
      const { signOut: firebaseSignOut } = await import("firebase/auth");
      await firebaseSignOut(getClientAuth());
    }
    setUser(null);
    setStatus("signed-out");
  }, [localMode]);

  const value = useMemo(() => ({ user, status, error, signOut }), [user, status, error, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
