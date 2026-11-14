interface StoredFile {
  path: string;
  blob: Blob;
}

const DATABASE_NAME = "briefcase-local-files";
const STORE_NAME = "files";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Local file storage is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "path" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local file storage."));
  });
}

export async function saveLocalFile(path: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ path, blob } satisfies StoredFile);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the file locally."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Local file save was cancelled."));
  });
  database.close();
}

export async function readLocalFile(path: string): Promise<Blob | null> {
  const database = await openDatabase();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(path);
    request.onsuccess = () => {
      const result: unknown = request.result;
      if (typeof result === "object" && result !== null && "blob" in result && result.blob instanceof Blob) resolve(result.blob);
      else resolve(null);
    };
    request.onerror = () => reject(request.error ?? new Error("Could not read the local file."));
  });
  database.close();
  return blob;
}

export async function deleteLocalFile(path: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(path);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove the local file."));
  });
  database.close();
}
