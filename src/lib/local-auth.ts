import type { TeamMember, UserRole, WorkspaceUser } from "@/types/models";
import { LOCAL_AUTH_EVENT, readLocalCollection, removeLocalRecord, writeLocalRecord } from "@/lib/local-store";

interface LocalAccount {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  profile: WorkspaceUser;
  createdAt: string;
}

const ACCOUNTS_KEY = "briefcase:local:accounts";
const CURRENT_USER_KEY = "briefcase:local:current-user";

function isAccount(value: unknown): value is LocalAccount {
  if (typeof value !== "object" || value === null) return false;
  return "id" in value && typeof value.id === "string" &&
    "email" in value && typeof value.email === "string" &&
    "passwordHash" in value && typeof value.passwordHash === "string" &&
    "salt" in value && typeof value.salt === "string" &&
    "profile" in value && typeof value.profile === "object" && value.profile !== null;
}

function readAccounts(): LocalAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAccount) : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: LocalAccount[]): void {
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function dispatchAuthChange(): void {
  window.dispatchEvent(new Event(LOCAL_AUTH_EVENT));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const salt = Uint8Array.from(saltHex.match(/.{1,2}/g) ?? [], (value) => Number.parseInt(value, 16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" }, key, 256);
  return toHex(new Uint8Array(bits));
}

function readInvitation(email: string): { id: string; firmId: string; role: UserRole } | null {
  const invitation = readLocalCollection<{ id: string; email: string; firmId: string; role: UserRole }>("teamInvites")
    .find((item) => item.email.toLowerCase() === email);
  return invitation ? { id: invitation.id, firmId: invitation.firmId, role: invitation.role } : null;
}

export function getLocalUser(): WorkspaceUser | null {
  if (typeof window === "undefined") return null;
  const uid = window.localStorage.getItem(CURRENT_USER_KEY);
  if (!uid) return null;
  return readAccounts().find((account) => account.id === uid)?.profile ?? null;
}

export function subscribeLocalAuth(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CURRENT_USER_KEY || event.key === ACCOUNTS_KEY) listener();
  };
  window.addEventListener(LOCAL_AUTH_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LOCAL_AUTH_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export async function signUpLocal(name: string, emailInput: string, password: string): Promise<WorkspaceUser> {
  const email = emailInput.trim().toLowerCase();
  if (name.trim().length < 2) throw new Error("Enter your full name.");
  if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
  if (readAccounts().some((account) => account.email === email)) throw new Error("An account with this email already exists in this browser.");

  const invitation = readInvitation(email);
  const uid = crypto.randomUUID();
  const firmId = invitation?.firmId ?? `local_firm_${crypto.randomUUID()}`;
  const role: UserRole = invitation?.role ?? "administrator";
  const now = new Date().toISOString();
  const profile: WorkspaceUser = { uid, email, displayName: name.trim(), photoURL: null, firmId, role };
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const passwordHash = await hashPassword(password, salt);
  const account: LocalAccount = { id: uid, email, passwordHash, salt, profile, createdAt: now };

  writeAccounts([...readAccounts(), account]);
  if (!invitation) {
    writeLocalRecord("firms", firmId, { name: "Moyo & Partners", address: "Harare, Zimbabwe", phone: "", email, firmId });
  }
  const teamMember: Omit<TeamMember, "id"> = { ...profile, status: "active", firmId, createdAt: now };
  writeLocalRecord("team", uid, teamMember);
  if (invitation) removeLocalRecord("teamInvites", invitation.id);
  window.localStorage.setItem(CURRENT_USER_KEY, uid);
  dispatchAuthChange();
  return profile;
}

export async function signInLocal(emailInput: string, password: string): Promise<WorkspaceUser> {
  const email = emailInput.trim().toLowerCase();
  const account = readAccounts().find((item) => item.email === email);
  if (!account || await hashPassword(password, account.salt) !== account.passwordHash) {
    throw new Error("Email or password is incorrect.");
  }
  window.localStorage.setItem(CURRENT_USER_KEY, account.id);
  dispatchAuthChange();
  return account.profile;
}

export function signOutLocal(): void {
  window.localStorage.removeItem(CURRENT_USER_KEY);
  dispatchAuthChange();
}
