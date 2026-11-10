import type { Place } from "./places.ts";

// Une entrée = tous les lieux d'une catégorie dans une cellule de la grille
export interface Entry {
  t: number;
  truncated: boolean;
  places: Place[];
}

const TTL_MS = 7 * 24 * 3600 * 1000;
const mem = new Map<string, Entry>();
let dbPromise: Promise<IDBDatabase | null> | undefined;

const fresh = (e: Entry) => Date.now() - e.t < TTL_MS;

// IndexedDB peut être absent ou bloqué (navigation privée) : dans ce cas on garde seulement la mémoire
function openDb(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open("tournee", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("cells");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function getCells(keys: string[]): Promise<Map<string, Entry>> {
  const found = new Map<string, Entry>();
  const need: string[] = [];
  for (const k of keys) {
    const e = mem.get(k);
    if (e && fresh(e)) found.set(k, e);
    else need.push(k);
  }
  const db = await openDb();
  if (!db || need.length === 0) return found;

  await new Promise<void>((done) => {
    try {
      const store = db.transaction("cells").objectStore("cells");
      let left = need.length;
      const next = () => --left === 0 && done();
      for (const k of need) {
        const req = store.get(k);
        req.onsuccess = () => {
          const e = req.result as Entry | undefined;
          if (e && fresh(e)) {
            mem.set(k, e);
            found.set(k, e);
          }
          next();
        };
        req.onerror = next;
      }
    } catch {
      done();
    }
  });
  return found;
}

export async function putCells(entries: [string, Entry][]): Promise<void> {
  for (const [k, e] of entries) mem.set(k, e);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((done) => {
    try {
      const tx = db.transaction("cells", "readwrite");
      for (const [k, e] of entries) tx.objectStore("cells").put(e, k);
      tx.oncomplete = tx.onerror = tx.onabort = () => done();
    } catch {
      done();
    }
  });
}
