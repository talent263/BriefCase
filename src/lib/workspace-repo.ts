"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, ref, uploadBytesResumable } from "firebase/storage";
import { getClientDb, getClientStorage } from "@/lib/firebase/client";
import { isLocalMode } from "@/lib/local-mode";
import { deleteLocalFile, readLocalFile, saveLocalFile } from "@/lib/local-files";
import {
  patchLocalRecord,
  readLocalCollection,
  removeLocalRecord,
  writeLocalRecord,
  type WorkspaceCollectionName,
} from "@/lib/local-store";
import type { Matter, MatterDocument, UserRole } from "@/types/models";

function newId(): string {
  return crypto.randomUUID();
}

export async function createRecord(
  collectionName: WorkspaceCollectionName,
  data: Record<string, unknown>,
): Promise<string> {
  if (isLocalMode()) {
    const id = newId();
    writeLocalRecord(collectionName, id, data);
    return id;
  }
  const created = await addDoc(collection(getClientDb(), collectionName), data);
  return created.id;
}

export async function setRecord(
  collectionName: WorkspaceCollectionName,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (isLocalMode()) {
    writeLocalRecord(collectionName, id, data);
    return;
  }
  await setDoc(doc(getClientDb(), collectionName, id), data);
}

export async function updateRecord(
  collectionName: WorkspaceCollectionName,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (isLocalMode()) {
    patchLocalRecord(collectionName, id, data);
    return;
  }
  await updateDoc(doc(getClientDb(), collectionName, id), data);
}

export async function deleteRecord(
  collectionName: WorkspaceCollectionName,
  id: string,
): Promise<void> {
  if (isLocalMode()) {
    removeLocalRecord(collectionName, id);
    return;
  }
  await deleteDoc(doc(getClientDb(), collectionName, id));
}

export async function createMatterRecord(
  firmId: string,
  values: Omit<Matter, "id" | "matterNumber" | "firmId" | "createdAt">,
  existingMatters: Matter[],
): Promise<{ id: string; matterNumber: string }> {
  const year = new Date().getFullYear();
  const now = new Date().toISOString();

  if (isLocalMode()) {
    const counters = readLocalCollection<{ id: string; lastMatterNumber: number }>("matterCounters");
    const counter = counters.find((item) => item.id === firmId);
    const last = counter && Number.isInteger(counter.lastMatterNumber) && counter.lastMatterNumber >= 0
      ? counter.lastMatterNumber
      : existingMatters.reduce((max, item) => {
          const candidate = Number(item.matterNumber.split("-").at(-1));
          return Number.isFinite(candidate) ? Math.max(max, candidate) : max;
        }, 0);
    const sequence = last + 1;
    const matterNumber = `EST-${year}-${String(sequence).padStart(3, "0")}`;
    writeLocalRecord("matterCounters", firmId, { firmId, lastMatterNumber: sequence });
    writeLocalRecord("matters", matterNumber, {
      matterNumber,
      ...values,
      firmId,
      createdAt: now,
    });
    return { id: matterNumber, matterNumber };
  }

  const db = getClientDb();
  const counterRef = doc(db, "matterCounters", firmId);
  return runTransaction(db, async (transaction) => {
    const counter = await transaction.get(counterRef);
    const previousValue: unknown = counter.exists() ? counter.data().lastMatterNumber : 0;
    const last = typeof previousValue === "number" && Number.isInteger(previousValue) && previousValue >= 0 ? previousValue : 0;
    const sequence = last + 1;
    const matterNumber = `EST-${year}-${String(sequence).padStart(3, "0")}`;
    const matterRef = doc(db, "matters", matterNumber);
    transaction.set(counterRef, { firmId, lastMatterNumber: sequence });
    transaction.set(matterRef, {
      matterNumber,
      ...values,
      firmId,
      createdAt: now,
    });
    return { id: matterNumber, matterNumber };
  });
}

export async function uploadDocumentFile(options: {
  file: File;
  firmId: string;
  matterId: string;
  matterNumber: string;
  uploadedBy: string;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  const { file, firmId, matterId, matterNumber, uploadedBy, onProgress } = options;
  const id = newId();
  const storagePath = `firms/${firmId}/documents/${id}`;
  const createdAt = new Date().toISOString();
  const meta = {
    fileName: file.name,
    matterId,
    matterNumber,
    storagePath,
    contentType: file.type,
    size: file.size,
    uploadedBy,
    firmId,
    createdAt,
  };

  if (isLocalMode()) {
    onProgress?.(15);
    await saveLocalFile(storagePath, file);
    onProgress?.(85);
    writeLocalRecord("documents", id, meta);
    onProgress?.(100);
    return;
  }

  const db = getClientDb();
  const documentRef = doc(collection(db, "documents"));
  const firebasePath = `firms/${firmId}/documents/${documentRef.id}`;
  const storageRef = ref(getClientStorage(), firebasePath);
  let uploaded = false;
  try {
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (snapshot) => {
          onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        },
        reject,
        resolve,
      );
    });
    uploaded = true;
    await setDoc(documentRef, { ...meta, storagePath: firebasePath });
  } catch (error) {
    if (uploaded) await deleteObject(storageRef).catch(() => undefined);
    throw error;
  }
}

export async function downloadDocumentFile(file: MatterDocument): Promise<void> {
  if (isLocalMode()) {
    const blob = await readLocalFile(file.storagePath);
    if (!blob) throw new Error("Document could not be found locally.");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const response = await fetch(`/api/documents/${encodeURIComponent(file.id)}/download`, { credentials: "same-origin" });
  const payload: unknown = await response.json();
  if (!response.ok || typeof payload !== "object" || payload === null || !("url" in payload) || typeof payload.url !== "string") {
    throw new Error("Download unavailable");
  }
  window.open(payload.url, "_blank", "noopener,noreferrer");
}

export async function deleteDocumentFile(file: MatterDocument): Promise<void> {
  if (isLocalMode()) {
    await deleteLocalFile(file.storagePath);
    removeLocalRecord("documents", file.id);
    return;
  }
  await deleteObject(ref(getClientStorage(), file.storagePath));
  await deleteDoc(doc(getClientDb(), "documents", file.id));
}

export function createLocalInvite(firmId: string, email: string, role: UserRole): void {
  const normalized = email.trim().toLowerCase();
  const existing = readLocalCollection<{ id: string; email: string; firmId: string }>("teamInvites")
    .find((invite) => invite.email === normalized && invite.firmId === firmId);
  if (existing) throw new Error("That email already has a pending invitation.");
  writeLocalRecord("teamInvites", newId(), {
    email: normalized,
    role,
    firmId,
    createdAt: new Date().toISOString(),
  });
}

export function cancelLocalInvite(id: string): void {
  removeLocalRecord("teamInvites", id);
}
