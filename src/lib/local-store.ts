import type { CollectionState } from "@/types/models";

export const LOCAL_DATA_EVENT = "briefcase:local-data";
export const LOCAL_AUTH_EVENT = "briefcase:local-auth";

export type WorkspaceCollectionName =
  | "matters"
  | "clients"
  | "tasks"
  | "invoices"
  | "calendar"
  | "documents"
  | "team"
  | "firms"
  | "teamInvites"
  | "matterCounters";

interface LocalRecord {
  id: string;
  [key: string]: unknown;
}

function storageKey(collectionName: WorkspaceCollectionName): string {
  return `briefcase:workspace:${collectionName}`;
}

function isLocalRecord(value: unknown): value is LocalRecord {
  return typeof value === "object" && value !== null && "id" in value && typeof value.id === "string";
}

function readRecords(collectionName: WorkspaceCollectionName): LocalRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(collectionName));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isLocalRecord) : [];
  } catch {
    return [];
  }
}

function writeRecords(collectionName: WorkspaceCollectionName, records: LocalRecord[]): void {
  if (typeof window === "undefined") throw new Error("Browser storage is unavailable.");
  window.localStorage.setItem(storageKey(collectionName), JSON.stringify(records));
  window.dispatchEvent(new CustomEvent(LOCAL_DATA_EVENT, { detail: { collectionName } }));
}

export function readLocalCollection<T extends { id: string }>(collectionName: WorkspaceCollectionName): T[] {
  return readRecords(collectionName) as T[];
}

export function writeLocalRecord<T extends object>(collectionName: WorkspaceCollectionName, id: string, data: T): void {
  const record = { ...data, id } as LocalRecord;
  const records = readRecords(collectionName);
  const existingIndex = records.findIndex((entry) => entry.id === id);
  if (existingIndex >= 0) records[existingIndex] = record;
  else records.unshift(record);
  writeRecords(collectionName, records);
}

export function patchLocalRecord(collectionName: WorkspaceCollectionName, id: string, data: object): void {
  const records = readRecords(collectionName);
  const index = records.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error("Record not found.");
  records[index] = { ...records[index], ...data } as LocalRecord;
  writeRecords(collectionName, records);
}

export function removeLocalRecord(collectionName: WorkspaceCollectionName, id: string): void {
  writeRecords(collectionName, readRecords(collectionName).filter((entry) => entry.id !== id));
}

export function subscribeLocalStore(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith("briefcase:workspace:")) listener();
  };
  window.addEventListener(LOCAL_DATA_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LOCAL_DATA_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function localCollectionState<T>(items: T[]): CollectionState<T> {
  return { items, loading: false, error: null };
}
