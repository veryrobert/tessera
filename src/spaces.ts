// Spaces: parts of the frame the pattern gives way to, for a photo or for type (a flat colour).
// Kept as fractions of the frame and snapped to whole cells when drawn, so they stay put while
// the pattern slides underneath and still sit on the grid as it zooms.

// A space: x, y, w, h are fractions of the frame; role is a blank's colour (one of the palette's);
// image is 's:<unsplash photo>' for a studio portrait or 'u:<id>' for a photo you added
import type { Space } from '@/lib/pattern'
import { openDb } from '@/library'
export type { Space }

// Everyday people, warm and candid, mid-shot, in colour, as in the Waybill posts; from Unsplash
// (free to use under the Unsplash License), loaded from Unsplash's image server and cropped to the space
export const PORTRAITS = [
  { path: 'photo-1626470689496-503424c78c08', by: 'sample_in_photography' },
  { path: 'photo-1738739906007-d7372e74c329', by: 'cmrcn_' },
  { path: 'photo-1765046300927-6c1827612c42', by: 'vanishing_point_images' },
  { path: 'photo-1779369495842-7a16b773f4b9', by: 'alef_visuals' },
  { path: 'photo-1747374135959-9291ba69215e', by: 'aks_by_aamir' },
  { path: 'photo-1706951413911-a4477e18ccd5', by: 'martynovych' },
  { path: 'photo-1627130595904-ebeeb6540a93', by: 'freddy_mishiki' },
  { path: 'photo-1654272763471-87c0ebf395f8', by: 'cutinamoment' },
  { path: 'photo-1579105728744-9d6b14a45389', by: 'itsomidarmin' },
  { path: 'photo-1594756154841-ac5d160dbf46', by: 'meganmarkham' },
  { path: 'photo-1549045337-967927d923c0', by: 'sayolo' },
  { path: 'photo-1685541003882-7328ef51bac8', by: 'divaris' },
  { path: 'photo-1746688833041-4681ba4d5cf4', by: 'hng21' },
  { path: 'photo-1508002366005-75a695ee2d17', by: 'isaiahmcclean' },
  { path: 'photo-1611682060567-d7b07878d380', by: 'gemasaputera' },
  { path: 'photo-1749700332031-cf99864959ea', by: 'ogulu_18' },
] as const

export const randomImage = (not?: string) => {
  const pool = PORTRAITS.filter(p => `s:${p.path}` !== not)
  return `s:${pool[Math.floor(Math.random() * pool.length)].path}`
}
export const credit = (image?: string) => {
  const p = image?.startsWith('s:') && PORTRAITS.find(q => `s:${q.path}` === image)
  return p ? `Photo: @${p.by}, Unsplash` : null
}

// ---------- Images: fetched once and kept as data URLs, so they export inside PNG and SVG ----------
const cache = new Map<string, Promise<string>>()
const toDataUrl = (blob: Blob) => new Promise<string>((ok, fail) => {
  const r = new FileReader()
  r.onload = () => ok(r.result as string)
  r.onerror = () => fail(r.error)
  r.readAsDataURL(blob)
})

export function loadImage(image: string): Promise<string> {
  let p = cache.get(image)
  if (!p) {
    p = image.startsWith('s:')
      ? fetch(`https://images.unsplash.com/${image.slice(2)}?w=1000&h=1250&fit=crop&crop=faces&q=80`).then(r => r.blob()).then(toDataUrl)
      : getUpload(image.slice(2)).then(b => (b ? toDataUrl(b) : Promise.reject(new Error('missing'))))
    p.catch(() => cache.delete(image))
    cache.set(image, p)
  }
  return p
}

// Photos you add stay in this browser (IndexedDB); a shared link shows them as empty spaces elsewhere
const db = openDb // the app's one database (library.ts), which keeps photos alongside saved patterns
export async function addUpload(file: Blob): Promise<string> {
  const id = Math.random().toString(36).slice(2, 10)
  try {
    const d = await db()
    await new Promise<void>((ok, fail) => {
      const t = d.transaction('photos', 'readwrite')
      t.objectStore('photos').put(file, id)
      t.oncomplete = () => ok()
      t.onerror = () => fail(t.error)
    })
  } catch { /* storage unavailable: the photo still shows until the page closes */ }
  cache.set(`u:${id}`, toDataUrl(file))
  return `u:${id}`
}
async function getUpload(id: string): Promise<Blob | undefined> {
  try {
    const d = await db()
    return await new Promise((ok, fail) => {
      const req = d.transaction('photos').objectStore('photos').get(id)
      req.onsuccess = () => ok(req.result)
      req.onerror = () => fail(req.error)
    })
  } catch { return undefined }
}
