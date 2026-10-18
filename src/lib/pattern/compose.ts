import { type Rng, fork, int, pick } from './random'

// Compositions: big flat rectangles, strips and striped modules, drawn as shapes rather than cells,
// after the Duluth wrappers.
//   bricks   rows of bricks of mixed widths (dark chocolate)
//   strips   strips of mixed widths cut from the edges inward, like a loose log cabin (milk)
//   stripes  modules each filled with stripes, some carrying a striped circle or dome (hazelnut)
//   nest     rectangles inside rectangles, each pushed off-centre so the one around it shows as an L,
//            with now and then a thin bar of accent along an edge (after the colour-field prints)

export type ComposeStyle = 'bricks' | 'strips' | 'stripes' | 'nest'
export type ComposeSpec = { style: ComposeStyle; cols: number; rows: number; size: number } // size: brick, strip or module size

export type Stripes = { dir: 'h' | 'v'; count: number; alt: number }
export type Item = {
  kind: 'rect' | 'circle' | 'dome'
  x: number; y: number; w: number; h: number
  role: number
  stripes?: Stripes // role and alt alternate, role first
}

// A role unlike the ones to avoid; dark (role 2) comes up more, as the brown does on the wrappers
function colour(r: Rng, roles: number, avoid: number[] = []) {
  const options = Array.from({ length: roles }, (_, i) => i).filter(i => !avoid.includes(i))
  const pool = options.length ? options : [0]
  return r() < 0.22 && pool.includes(2) ? 2 : pick(r, pool)
}

export function compose(seed: number, spec: ComposeSpec, roles: number): Item[] {
  const r = fork(seed, 7)
  const { cols, rows } = spec
  const size = Math.max(1, spec.size)
  const items: Item[] = []

  if (spec.style === 'bricks') {
    let above: Item[] = []
    for (let y = 0; y < rows;) {
      const h = r() < 0.25 ? 2 : 1
      const row: Item[] = []
      for (let x = 0; x < cols;) {
        const w = Math.max(1, Math.round(size * pick(r, [0.5, 1, 1, 1.5, 2])))
        const near = above.filter(a => a.x < x + w && a.x + a.w > x).map(a => a.role)
        const left = row.length ? [row[row.length - 1].role] : []
        row.push({ kind: 'rect', x, y, w, h, role: colour(r, roles, [...left, ...near]) })
        x += w
      }
      items.push(...row)
      above = row
      y += h
    }
    return items
  }

  if (spec.style === 'strips') {
    let x = 0, y = 0, w = cols, h = rows, last = -1
    const sides = ['n', 'e', 's', 'w'] as const
    let side = int(r, 0, 3)
    while (w > 0 && h > 0) {
      const t = Math.max(1, Math.round(size * pick(r, [0.5, 1, 1, 1.5])))
      const role = colour(r, roles, [last])
      last = role
      const s = sides[side % 4]
      if (w <= t || h <= t) { items.push({ kind: 'rect', x, y, w, h, role }); break }
      if (s === 'n') { items.push({ kind: 'rect', x, y, w, h: t, role }); y += t; h -= t }
      if (s === 's') { items.push({ kind: 'rect', x, y: y + h - t, w, h: t, role }); h -= t }
      if (s === 'w') { items.push({ kind: 'rect', x, y, w: t, h, role }); x += t; w -= t }
      if (s === 'e') { items.push({ kind: 'rect', x: x + w - t, y, w: t, h, role }); w -= t }
      // Mostly go round; sometimes cut the same side twice
      side += r() < 0.75 ? 1 : 0
    }
    return items
  }

  if (spec.style === 'nest') {
    let x = 0, y = 0, w = cols, h = rows, last = colour(r, roles)
    items.push({ kind: 'rect', x, y, w, h, role: last })
    const depth = int(r, 3, 5)
    for (let d = 0; d < depth && w > 3 && h > 3; d++) {
      // Each side keeps flush, takes a thin band, or a wide one; never all flush
      const margin = (len: number) => pick(r, [0, 0, 1, 1, Math.max(1, Math.round(len * (0.18 + r() * 0.22)))])
      let l = margin(w), t = margin(h), rt = margin(w), b = margin(h)
      if (!l && !t && !rt && !b) l = 1
      if (l + rt >= w - 1) rt = 0
      if (t + b >= h - 1) b = 0
      x += l; y += t; w -= l + rt; h -= t + b
      const role = colour(r, roles, [last])
      items.push({ kind: 'rect', x, y, w, h, role })
      // A thin bar of accent along one inside edge, sometimes
      if (r() < 0.35 && w > 2 && h > 2) {
        const accent = colour(r, roles, [role]), along = r() < 0.5
        const len = Math.max(1, Math.round((along ? w : h) * (0.15 + r() * 0.5)))
        items.push(along
          ? { kind: 'rect', x: r() < 0.5 ? x : x + w - len, y: r() < 0.5 ? y : y + h - 1, w: len, h: 1, role: accent }
          : { kind: 'rect', x: r() < 0.5 ? x : x + w - 1, y: r() < 0.5 ? y : y + h - len, w: 1, h: len, role: accent })
      }
      last = role
    }
    return items
  }

  // stripes
  const m = size
  for (let y = 0; y < rows; y += m)
    for (let x = 0; x < cols; x += m) {
      const a = colour(r, roles), b = colour(r, roles, [a])
      const stripes: Stripes = { dir: r() < 0.5 ? 'h' : 'v', count: pick(r, [3, 4, 5, 6]), alt: b }
      items.push({ kind: 'rect', x, y, w: m, h: m, role: a, stripes })
      const k = r()
      if (k < 0.22) {
        const c = colour(r, roles, [a, b]), d = colour(r, roles, [c])
        const inner: Stripes = { dir: stripes.dir === 'h' ? 'v' : 'h', count: pick(r, [3, 4, 5]), alt: d }
        items.push({ kind: k < 0.12 ? 'circle' : 'dome', x, y, w: m, h: m, role: c, stripes: r() < 0.8 ? inner : undefined })
      }
    }
  return items
}
