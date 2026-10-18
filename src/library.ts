// The library, as in loom: patterns you save (named, to load again) and the files you've exported
// (to download again). Kept in this browser's IndexedDB, which holds the files themselves.
import type { Spec } from '@/lib/pattern'

export type Saved = { id: string; name: string; spec: Spec; createdAt: number }
export type Download = { id: string; filename: string; mime: string; size: number; blob: Blob; createdAt: number; spec: Spec }

const DB = 'tessera', VERSION = 2

export function openDb(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const req = indexedDB.open(DB, VERSION)
    req.onupgradeneeded = () => {
      const d = req.result
      for (const store of ['photos', 'saved', 'downloads']) if (!d.objectStoreNames.contains(store)) d.createObjectStore(store)
    }
    req.onsuccess = () => ok(req.result)
    req.onerror = () => fail(req.error)
  })
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
  const d = await openDb()
  return new Promise((ok, fail) => {
    const t = d.transaction(store, mode)
    const req = fn(t.objectStore(store))
    t.oncomplete = () => ok(req ? (req.result as T) : undefined)
    t.onerror = () => fail(t.error)
  })
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const newestFirst = <T extends { createdAt: number }>(xs: T[] = []) => xs.sort((a, b) => b.createdAt - a.createdAt)

// Storage can be unavailable (private mode, blocked site data): the app still works, it just forgets
export const listSaved = () => run<Saved[]>('saved', 'readonly', s => s.getAll()).then(newestFirst).catch(() => [] as Saved[])
export const putSaved = (x: Saved) => run('saved', 'readwrite', s => { s.put(x, x.id) }).catch(() => {})
export const deleteSaved = (id: string) => run('saved', 'readwrite', s => { s.delete(id) }).catch(() => {})
export const newSaved = (name: string, spec: Spec): Saved => ({ id: newId(), name, spec, createdAt: Date.now() })

export const listDownloads = () => run<Download[]>('downloads', 'readonly', s => s.getAll()).then(newestFirst).catch(() => [] as Download[])
export const deleteDownload = (id: string) => run('downloads', 'readwrite', s => { s.delete(id) }).catch(() => {})
export async function addDownload(filename: string, blob: Blob, spec: Spec) {
  const x: Download = { id: newId(), filename, mime: blob.type, size: blob.size, blob, createdAt: Date.now(), spec }
  await run('downloads', 'readwrite', s => { s.put(x, x.id) }).catch(() => {})
  return x
}
