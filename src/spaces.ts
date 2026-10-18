// Spaces: parts of the frame the pattern gives way to, for a photo or for type (a flat colour).
// Kept as fractions of the frame and snapped to whole cells when drawn, so they stay put while
// the pattern slides underneath and still sit on the grid as it zooms.

// A space: x, y, w, h are fractions of the frame; role is a blank's colour (one of the palette's);
// image is 's:<unsplash photo>' for a studio portrait or 'u:<id>' for a photo you added
import type { Space } from '@/lib/pattern'
export type { Space }

// Simple, friendly portraits on plain or coloured backgrounds (studio-ish, not moody), from Unsplash
// (free to use under the Unsplash License), loaded from Unsplash's image server and cropped to the space
export const PORTRAITS = [
  { path: 'photo-1531746020798-e6953c6e8e04', by: 'jimmyferminphotography' },
  { path: 'photo-1764069415137-756fbca30a17', by: 'chriscreations__' },
  { path: 'photo-1784651988968-8e66442d058c', by: 'thisismcfollis' },
  { path: 'photo-1631002724711-d1ae3cf651b0', by: 'oiasana' },
  { path: 'photo-1649058047388-b49c028df9ac', by: 'rehtrew' },
  { path: 'photo-1608355023471-c13d29ac8fbf', by: 'mannydream' },
  { path: 'photo-1520529277867-dbf8c5e0b340', by: 'jotalao' },
  { path: 'photo-1535295972055-1c762f4483e5', by: 'von_co' },
  { path: 'flagged/photo-1596479042555-9265a7fa7983', by: 'jsshotz' },
  { path: 'photo-1580489944761-15a19d654956', by: 'jakenackos' },
  { path: 'photo-1613419441661-6a5af1751d30', by: 'real_chance12' },
  { path: 'photo-1745434159123-4908d0b9df94', by: 'brookebalentine' },
  { path: 'photo-1585237017125-24baf8d7406f', by: 'sincerelymedia' },
  { path: 'photo-1611695434369-a8f5d76ceb7b', by: 'nicotitto' },
  { path: 'photo-1656593449296-0ae0f849a578', by: 'kohlun2000' },
  { path: 'photo-1567479169571-44be2b9916b2', by: 'labmagik' },
] as const

// Soft gradients and colour blurs, also from Unsplash, for when a space wants colour, not a face
export const ABSTRACT = [
  { path: 'photo-1604342427523-189b17048839', by: 'magellol' },
  { path: 'photo-1647724065002-1bacc096d006', by: 'mihaiteslariu0' },
  { path: 'photo-1697725690884-012c8cd25f30', by: 'mihaiteslariu0' },
  { path: 'photo-1579547944212-c4f4961a8dd8', by: 'codioful' },
  { path: 'photo-1647724065041-628d5b61c145', by: 'mihaiteslariu0' },
  { path: 'photo-1615715757462-9ce10a340052', by: 'codioful' },
  { path: 'photo-1607567494076-ab61e59e841a', by: 'lover1212' },
  { path: 'photo-1495921015075-c888398b885e', by: 'nicolasladinosilva' },
  { path: 'photo-1604079628040-94301bb21b91', by: 'mymind' },
  { path: 'photo-1658998765621-2cf0f12e059f', by: 'radoslavbali' },
  { path: 'photo-1604076947037-d909e2f10fca', by: 'mymind' },
  { path: 'photo-1658998765622-962cb51e7888', by: 'radoslavbali' },
  { path: 'photo-1604076913837-52ab5629fba9', by: 'mymind' },
  { path: 'photo-1646038572806-3d5f4252c567', by: 'vinhundred' },
  { path: 'photo-1646038572815-43fe759e459b', by: 'vinhundred' },
  { path: 'photo-1604076984203-587c92ab2e58', by: 'mymind' },
] as const

export type ImageSet = 'people' | 'abstract'
const SETS = { people: PORTRAITS, abstract: ABSTRACT }
export const setOf = (image?: string): ImageSet => (ABSTRACT.some(q => `s:${q.path}` === image) ? 'abstract' : 'people')
export const randomImage = (set: ImageSet, not?: string) => {
  const pool = SETS[set].filter(p => `s:${p.path}` !== not)
  return `s:${pool[Math.floor(Math.random() * pool.length)].path}`
}
export const credit = (image?: string) => {
  const p = image?.startsWith('s:') && [...PORTRAITS, ...ABSTRACT].find(q => `s:${q.path}` === image)
  return p ? `Photo: @${p.by}, Unsplash` : null
}

// Starting layouts, after the Waybill posts and posters; the pattern fills what's left
type Part = Omit<Space, 'role' | 'image'>
const img = (x: number, y: number, w: number, h: number): Part => ({ x, y, w, h, kind: 'image' })
const blank = (x: number, y: number, w: number, h: number): Part => ({ x, y, w, h, kind: 'blank' })
export const LAYOUTS: { name: string; parts: Part[] }[] = [
  { name: 'None', parts: [] },
  { name: 'Type top', parts: [blank(0, 0, 1, 0.5)] },
  { name: 'Type corner', parts: [blank(0, 0.5, 0.75, 0.5)] },
  { name: 'Image left', parts: [img(0, 0, 0.5, 1)] },
  { name: 'Image frame', parts: [img(0.125, 0.125, 0.75, 0.75)] },
  { name: 'Poster', parts: [blank(0, 0, 0.75, 0.5), img(0, 0.5, 0.75, 0.5)] },
  { name: 'Image and type', parts: [img(0, 0, 1, 0.5), blank(0, 0.5, 0.75, 0.5)] },
  { name: 'Type and image', parts: [blank(0, 0, 0.75, 0.5), img(0.25, 0.5, 0.75, 0.5)] },
]

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
function db(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const req = indexedDB.open('tessera', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('photos')
    req.onsuccess = () => ok(req.result)
    req.onerror = () => fail(req.error)
  })
}
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
